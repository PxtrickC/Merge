import { ethers } from 'ethers'
import { MERGE_CONTRACT_ADDRESS } from '~/utils/contract.mjs'
import {
  SEAPORT_ADDRESS,
  OPENSEA_CONDUIT_KEY,
  OPENSEA_CONDUIT_ADDRESS,
  PLATFORM_FEE_BPS,
  WRAPPER_ADDRESS,
  WRAPPER_ABI,
} from '~/utils/trading.mjs'

// Seaport EIP-712 types for order signing
const SEAPORT_DOMAIN_NAME = 'Seaport'
const SEAPORT_DOMAIN_VERSION = '1.6'
const EIP712_TYPES = {
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' },
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
  ],
}

// Seaport fulfillBasicOrder ABI for encoding calldata
const SEAPORT_ABI = [
  'function fulfillBasicOrder_efficient_6GL6yc((address,uint256,uint256,address,address,address,uint256,uint256,uint8,uint256,uint256,bytes32,uint256,bytes32,bytes32,uint256,(uint256,address)[],bytes)) payable returns (bool)',
]

export function useTrading() {
  const buying = ref(false)
  const selling = ref(false)
  const txHash = ref(null)
  const error = ref(null)

  const { address, isConnected, getSigner, getProvider } = useWallet()
  const { trackEvent } = useAnalytics()

  // ------------------------------------------------------------------
  // BUY FLOW
  // ------------------------------------------------------------------
  async function buyToken(listing) {
    if (!isConnected.value) throw new Error('Connect wallet first')

    buying.value = true
    error.value = null
    txHash.value = null
    trackEvent('buy_initiated', { token_id: listing.tokenId, price_eth: listing.price })

    try {
      const signer = await getSigner()
      const fulfillerAddress = address.value

      // 1. Get fulfillment data from server proxy
      const fulfillmentData = await $fetch('/api/opensea/fulfill', {
        method: 'POST',
        body: {
          orderHash: listing.orderHash,
          protocolAddress: listing.protocolAddress,
          fulfillerAddress,
        },
      })

      // 2. Extract transaction data
      const txData = fulfillmentData.fulfillment_data?.transaction
      if (!txData) throw new Error('No transaction data received')

      // 3. Encode the Seaport calldata from OpenSea's structured parameters
      const params = txData.input_data?.parameters
      if (!params) throw new Error('No fulfillment parameters received')

      const orderTuple = [
        params.considerationToken,
        params.considerationIdentifier,
        params.considerationAmount,
        params.offerer,
        params.zone,
        params.offerToken,
        params.offerIdentifier,
        params.offerAmount,
        params.basicOrderType,
        params.startTime,
        params.endTime,
        params.zoneHash,
        params.salt,
        params.offererConduitKey,
        params.fulfillerConduitKey,
        params.totalOriginalAdditionalRecipients,
        (params.additionalRecipients || []).map(r => [r.amount, r.recipient]),
        params.signature,
      ]

      // 4. Encode Seaport calldata and send via wrapper (atomic fee collection)
      const seaportIface = new ethers.Interface(SEAPORT_ABI)
      const seaportCalldata = seaportIface.encodeFunctionData(
        'fulfillBasicOrder_efficient_6GL6yc', [orderTuple]
      )

      const listingValue = BigInt(txData.value)
      const fee = (listingValue * BigInt(PLATFORM_FEE_BPS)) / 10000n

      const wrapper = new ethers.Contract(WRAPPER_ADDRESS, WRAPPER_ABI, signer)
      const tx = await wrapper.buyWithFee(
        seaportCalldata,
        params.offerToken,
        params.offerIdentifier,
        listingValue,
        { value: listingValue + fee }
      )
      txHash.value = tx.hash
      await tx.wait()

      trackEvent('buy_completed', { token_id: listing.tokenId, price_eth: listing.price, tx_hash: tx.hash })
      return { success: true, txHash: tx.hash }
    } catch (err) {
      const msg = parseTradeError(err)
      if (msg) {
        error.value = msg
        trackEvent('buy_failed', { token_id: listing.tokenId, error_message: msg })
      }
      throw err
    } finally {
      buying.value = false
    }
  }

  // ------------------------------------------------------------------
  // SELL FLOW
  // ------------------------------------------------------------------
  async function sellToken(tokenId, priceInEth, durationDays = 30) {
    if (!isConnected.value) throw new Error('Connect wallet first')

    selling.value = true
    error.value = null
    trackEvent('sell_initiated', { token_id: tokenId, price_eth: priceInEth, duration_days: durationDays })

    try {
      const signer = await getSigner()
      const provider = await getProvider()

      // 1. Check NFT approval for OpenSea conduit
      const nftContract = new ethers.Contract(
        MERGE_CONTRACT_ADDRESS,
        [
          'function isApprovedForAll(address owner, address operator) view returns (bool)',
          'function setApprovalForAll(address operator, bool approved)',
        ],
        signer
      )
      const isApproved = await nftContract.isApprovedForAll(address.value, OPENSEA_CONDUIT_ADDRESS)
      if (!isApproved) {
        const approveTx = await nftContract.setApprovalForAll(OPENSEA_CONDUIT_ADDRESS, true)
        await approveTx.wait()
      }

      // 2. Fetch collection fees
      const collectionInfo = await $fetch('/api/opensea/collection-fees')
      const openseaFees = collectionInfo.fees || []

      // 3. Build consideration items
      const priceWei = ethers.parseEther(String(priceInEth))
      let totalFees = 0n
      const feeConsiderations = []

      // Only include required fees (OpenSea marketplace fee);
      // skip optional creator royalties to set them to 0
      const requiredFees = openseaFees.filter(f => f.required)
      for (const fee of requiredFees) {
        const feeBps = BigInt(Math.round(fee.fee * 100))
        const feeAmount = (priceWei * feeBps) / BigInt(10000)
        totalFees += feeAmount
        feeConsiderations.push({
          itemType: 0,
          token: ethers.ZeroAddress,
          identifierOrCriteria: '0',
          startAmount: feeAmount.toString(),
          endAmount: feeAmount.toString(),
          recipient: fee.recipient,
        })
      }

      // Note: platform seller fee removed — OpenSea rejects third-party fees
      // in consideration. Platform fee is only collected from buyers.

      // Seller receives price minus OpenSea/creator fees
      const sellerReceives = priceWei - totalFees

      const startTime = Math.floor(Date.now() / 1000)
      const endTime = startTime + durationDays * 24 * 60 * 60

      // 4. Build Seaport order
      const orderParameters = {
        offerer: address.value,
        zone: ethers.ZeroAddress,
        zoneHash: ethers.ZeroHash,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        orderType: 0, // FULL_OPEN
        salt: generateSalt(),
        conduitKey: OPENSEA_CONDUIT_KEY,
        offer: [
          {
            itemType: 2, // ERC721
            token: MERGE_CONTRACT_ADDRESS,
            identifierOrCriteria: tokenId.toString(),
            startAmount: '1',
            endAmount: '1',
          },
        ],
        consideration: [
          {
            itemType: 0, // NATIVE (ETH)
            token: ethers.ZeroAddress,
            identifierOrCriteria: '0',
            startAmount: sellerReceives.toString(),
            endAmount: sellerReceives.toString(),
            recipient: address.value,
          },
          ...feeConsiderations,
        ],
        totalOriginalConsiderationItems: 1 + feeConsiderations.length,
      }

      // 5. Get Seaport counter and sign
      const { chainId } = await provider.getNetwork()
      const seaportContract = new ethers.Contract(
        SEAPORT_ADDRESS,
        ['function getCounter(address offerer) view returns (uint256)'],
        provider
      )
      const counter = await seaportContract.getCounter(address.value)

      const domain = {
        name: SEAPORT_DOMAIN_NAME,
        version: SEAPORT_DOMAIN_VERSION,
        chainId: Number(chainId),
        verifyingContract: SEAPORT_ADDRESS,
      }

      orderParameters.counter = counter.toString()
      const signature = await signer.signTypedData(domain, EIP712_TYPES, orderParameters)

      // 6. Submit to OpenSea
      const result = await $fetch('/api/opensea/post-listing', {
        method: 'POST',
        body: { parameters: orderParameters, signature, protocol_address: SEAPORT_ADDRESS },
      })

      trackEvent('listing_created', { token_id: tokenId, price_eth: priceInEth })
      return { success: true, order: result }
    } catch (err) {
      const msg = parseTradeError(err)
      if (msg) {
        error.value = msg
        trackEvent('listing_failed', { token_id: tokenId, error_message: msg })
      }
      throw err
    } finally {
      selling.value = false
    }
  }

  return {
    buying,
    selling,
    txHash,
    error,
    buyToken,
    sellToken,
  }
}

function parseTradeError(err) {
  // User cancelled in wallet — not an error
  if (err.code === 'ACTION_REJECTED') return null
  // Insufficient ETH
  if (err.code === 'INSUFFICIENT_FUNDS' || err.message?.includes('insufficient funds'))
    return 'Insufficient ETH balance'
  // Server returned error (listing expired, already sold, etc.)
  if (err.statusCode === 400 || err.status === 400)
    return 'Order no longer available'
  if (err.statusCode >= 500 || err.status >= 500)
    return 'Server error, please try again'
  // Seaport revert (already filled, expired, etc.)
  if (err.code === 'CALL_EXCEPTION')
    return 'Transaction reverted — order may be filled or expired'
  // Network issues
  if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT')
    return 'Network error, please retry'
  // Fallback
  return 'Transaction failed'
}

function generateSalt() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
