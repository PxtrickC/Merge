// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================================
//  Minimal Interfaces
// ============================================================================

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
}

// ============================================================================
//  FullMath Library (Uniswap V3, MIT license) — mulDiv only
// ============================================================================

library FullMath {
    /// @notice Calculates floor(a * b / denominator) with full 512-bit precision.
    function mulDiv(uint256 a, uint256 b, uint256 denominator)
        internal pure returns (uint256 result)
    {
        uint256 prod0;
        uint256 prod1;
        assembly {
            let mm := mulmod(a, b, not(0))
            prod0 := mul(a, b)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }
        if (prod1 == 0) {
            require(denominator > 0);
            assembly { result := div(prod0, denominator) }
            return result;
        }
        require(denominator > prod1);
        uint256 remainder;
        assembly {
            remainder := mulmod(a, b, denominator)
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }
        uint256 twos = denominator & (~denominator + 1);
        assembly {
            denominator := div(denominator, twos)
            prod0 := div(prod0, twos)
            twos := add(div(sub(0, twos), twos), 1)
        }
        prod0 |= prod1 * twos;
        uint256 inv = (3 * denominator) ^ 2;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        result = prod0 * inv;
    }
}

// ============================================================================
//  MergeBuyWrapperV2
// ============================================================================

contract MergeBuyWrapperV2 {
    using FullMath for uint256;

    // --- Constants ---
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private constant Q192 = 2 ** 192;

    // --- Immutables ---
    address public immutable seaport;
    address public immutable swapRouter;
    address public immutable ASH;
    address public immutable WETH;
    address public immutable uniswapPool;
    uint256 public immutable maxFeeBps;

    // --- Ownable2Step ---
    address public owner;
    address public pendingOwner;

    // --- Pausable ---
    bool public paused;

    // --- ReentrancyGuard ---
    uint256 private _status;

    // --- Adjustable parameters ---
    uint256 public feeBps;
    address payable public feeRecipient;
    uint256 public maxSlippageBps;
    uint24 public poolFee;

    // --- Events ---
    event BuyExecuted(
        address indexed buyer,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 listingValue,
        uint256 feeAmount
    );
    event FeeSwappedToASH(uint256 ethAmount, uint256 ashAmount, address indexed recipient);
    event FeeSwapFailed(uint256 ethAmount, address indexed recipient);
    event FeeSentAsETH(uint256 ethAmount, address indexed recipient);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event MaxSlippageBpsUpdated(uint256 oldBps, uint256 newBps);
    event PoolFeeUpdated(uint24 oldFee, uint24 newFee);
    event Paused(address account);
    event Unpaused(address account);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TokenRescued(address indexed nftContract, address indexed to, uint256 tokenId);
    event ERC20Rescued(address indexed token, address indexed to, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrant");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // --- Constructor ---
    constructor(
        address _seaport,
        address _swapRouter,
        address _ash,
        address _weth,
        address _uniswapPool,
        uint256 _maxFeeBps,
        uint256 _feeBps,
        address payable _feeRecipient,
        uint256 _maxSlippageBps,
        uint24 _poolFee
    ) {
        require(_seaport != address(0), "Zero seaport");
        require(_swapRouter != address(0), "Zero router");
        require(_ash != address(0), "Zero ASH");
        require(_weth != address(0), "Zero WETH");
        require(_uniswapPool != address(0), "Zero pool");
        require(_feeRecipient != address(0), "Zero recipient");
        require(_maxFeeBps > 0 && _maxFeeBps <= 1000, "maxFeeBps: 1-1000");
        require(_feeBps <= _maxFeeBps, "feeBps > max");
        require(_maxSlippageBps <= 2000, "Slippage > 20%");
        require(_poolFee > 0, "Zero poolFee");

        seaport = _seaport;
        swapRouter = _swapRouter;
        ASH = _ash;
        WETH = _weth;
        uniswapPool = _uniswapPool;
        maxFeeBps = _maxFeeBps;

        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        maxSlippageBps = _maxSlippageBps;
        poolFee = _poolFee;

        owner = msg.sender;
        _status = _NOT_ENTERED;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ========================================================================
    //  Core: Buy NFT via Seaport + collect fee as ASH
    // ========================================================================

    /// @notice Buy an NFT via Seaport; fee is swapped to ASH and sent to feeRecipient.
    /// @dev Function signature identical to V1 for frontend compatibility.
    function buyWithFee(
        bytes calldata seaportCalldata,
        address nftContract,
        uint256 tokenId,
        uint256 listingValue
    ) external payable nonReentrant whenNotPaused {
        require(listingValue > 0, "Zero listing value");
        require(nftContract != address(0), "Zero NFT address");

        uint256 minFee = (listingValue * feeBps) / 10000;
        require(msg.value >= listingValue + minFee, "Insufficient payment");
        uint256 fee = msg.value - listingValue;

        // 1. Call Seaport with exact listing value
        (bool success,) = seaport.call{value: listingValue}(seaportCalldata);
        require(success, "Seaport failed");

        // 2. Transfer NFT to buyer
        IERC721(nftContract).transferFrom(address(this), msg.sender, tokenId);

        // 3. Handle fee (swap to ASH or fallback to ETH)
        _handleFee(fee);

        emit BuyExecuted(msg.sender, nftContract, tokenId, listingValue, fee);
    }

    // ========================================================================
    //  Internal: Fee handling with Uniswap V3 swap + ETH fallback
    // ========================================================================

    function _handleFee(uint256 feeAmount) internal {
        if (feeAmount == 0) return;

        bool swapped = _trySwapFee(feeAmount);

        if (!swapped) {
            (bool sent,) = feeRecipient.call{value: feeAmount}("");
            require(sent, "Fee fallback failed");
            emit FeeSentAsETH(feeAmount, feeRecipient);
        }
    }

    /// @dev Attempt ETH→ASH swap via Uniswap V3. Returns true on success.
    function _trySwapFee(uint256 feeAmount) internal returns (bool) {
        // Read current price from pool's slot0
        uint256 minAmountOut;
        try IUniswapV3Pool(uniswapPool).slot0() returns (
            uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool
        ) {
            uint256 sqrtPriceSq = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
            if (sqrtPriceSq == 0) return false;
            // ASH is token0, WETH is token1 → price = WETH/ASH
            // expectedASH = feeAmount * 2^192 / sqrtPriceX96^2
            uint256 expectedOut = FullMath.mulDiv(feeAmount, Q192, sqrtPriceSq);
            minAmountOut = (expectedOut * (10000 - maxSlippageBps)) / 10000;
        } catch {
            return false;
        }

        // Perform swap: ETH → WETH → ASH (router wraps ETH internally)
        try ISwapRouter(swapRouter).exactInputSingle{value: feeAmount}(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: ASH,
                fee: poolFee,
                recipient: feeRecipient,
                amountIn: feeAmount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 amountOut) {
            emit FeeSwappedToASH(feeAmount, amountOut, feeRecipient);
            return true;
        } catch {
            emit FeeSwapFailed(feeAmount, feeRecipient);
            return false;
        }
    }

    // ========================================================================
    //  Admin: Ownable2Step
    // ========================================================================

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
        pendingOwner = address(0);
    }

    // ========================================================================
    //  Admin: Pausable
    // ========================================================================

    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ========================================================================
    //  Admin: Parameter setters
    // ========================================================================

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= maxFeeBps, "Exceeds maxFeeBps");
        emit FeeBpsUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    function setFeeRecipient(address payable _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Zero address");
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    function setMaxSlippageBps(uint256 _maxSlippageBps) external onlyOwner {
        require(_maxSlippageBps <= 2000, "Slippage > 20%");
        emit MaxSlippageBpsUpdated(maxSlippageBps, _maxSlippageBps);
        maxSlippageBps = _maxSlippageBps;
    }

    function setPoolFee(uint24 _poolFee) external onlyOwner {
        require(_poolFee > 0, "Zero poolFee");
        emit PoolFeeUpdated(poolFee, _poolFee);
        poolFee = _poolFee;
    }

    // ========================================================================
    //  Emergency: Rescue stuck assets
    // ========================================================================

    function rescueToken(address nftContract, address to, uint256 tokenId) external onlyOwner {
        require(to != address(0), "Zero address");
        IERC721(nftContract).transferFrom(address(this), to, tokenId);
        emit TokenRescued(nftContract, to, tokenId);
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        emit ERC20Rescued(token, to, amount);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH");
        (bool s,) = owner.call{value: balance}("");
        require(s, "Withdraw failed");
        emit ETHWithdrawn(owner, balance);
    }

    // ========================================================================
    //  ERC721 receiver + receive ETH
    // ========================================================================

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}
