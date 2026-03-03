import { ethers } from 'ethers'
import { MERGE_CONTRACT_ADDRESS } from '~/utils/contract.mjs'
import {
  SEAPORT_ADDRESS,
  OPENSEA_CONDUIT_KEY,
  OPENSEA_CONDUIT_ADDRESS,
  PLATFORM_FEE_BPS,
  WRAPPER_ADDRESS,
  WRAPPER_ABI,
  WETH_ADDRESS,
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

// Seaport matchAdvancedOrders ABI (used for offer fulfillment)
const SEAPORT_MATCH_ABI = [
  'function matchAdvancedOrders(((address,address,(uint8,address,uint256,uint256,uint256)[],(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256),uint120,uint120,bytes,bytes)[],(uint256,uint8,uint256,uint256,bytes32[])[],((uint256,uint256)[],(uint256,uint256)[])[],address) payable',
]

// Seaport cancel ABI (named fields so ethers.js can map OpenSea's JSON objects)
const SEAPORT_CANCEL_ABI = [
  'function cancel((address offerer, address zone, (uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, (uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 counter)[] orders) external returns (bool)',
]

export function useTrading() {
  const buying = ref(false)
  const selling = ref(false)
  const transferring = ref(false)
  const makingOffer = ref(false)
  const acceptingOffer = ref(false)
  const cancellingListing = ref(false)
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

  // ------------------------------------------------------------------
  // MAKE OFFER FLOW (WETH-based offer via Seaport)
  // ------------------------------------------------------------------
  async function makeOffer(tokenId, priceInEth, durationDays = 7) {
    if (!isConnected.value) throw new Error('Connect wallet first')

    makingOffer.value = true
    error.value = null
    trackEvent('offer_initiated', { token_id: tokenId, price_eth: priceInEth })

    try {
      const signer = await getSigner()
      const provider = await getProvider()

      const priceWei = ethers.parseEther(String(priceInEth))

      // 1. Check WETH balance
      const wethContract = new ethers.Contract(
        WETH_ADDRESS,
        [
          'function balanceOf(address) view returns (uint256)',
          'function allowance(address owner, address spender) view returns (uint256)',
          'function approve(address spender, uint256 amount) returns (bool)',
        ],
        signer
      )
      const balance = await wethContract.balanceOf(address.value)
      if (balance < priceWei) throw new Error('Insufficient WETH balance')

      // 2. Approve WETH for OpenSea conduit if needed
      const allowance = await wethContract.allowance(address.value, OPENSEA_CONDUIT_ADDRESS)
      if (allowance < priceWei) {
        const approveTx = await wethContract.approve(OPENSEA_CONDUIT_ADDRESS, ethers.MaxUint256)
        await approveTx.wait()
      }

      // 3. Fetch collection fees
      const collectionInfo = await $fetch('/api/opensea/collection-fees')
      const openseaFees = collectionInfo.fees || []

      // 4. Build consideration items (NFT owner receives WETH minus fees)
      let totalFees = 0n
      const feeConsiderations = []

      const requiredFees = openseaFees.filter(f => f.required)
      for (const fee of requiredFees) {
        const feeBps = BigInt(Math.round(fee.fee * 100))
        const feeAmount = (priceWei * feeBps) / BigInt(10000)
        totalFees += feeAmount
        feeConsiderations.push({
          itemType: 1, // ERC20 (WETH)
          token: WETH_ADDRESS,
          identifierOrCriteria: '0',
          startAmount: feeAmount.toString(),
          endAmount: feeAmount.toString(),
          recipient: fee.recipient,
        })
      }

      const startTime = Math.floor(Date.now() / 1000)
      const endTime = startTime + durationDays * 24 * 60 * 60

      // 5. Build Seaport order (offer=WETH, consideration=ERC721)
      // Seller receives offer amount minus fee considerations automatically
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
            itemType: 1, // ERC20 (WETH)
            token: WETH_ADDRESS,
            identifierOrCriteria: '0',
            startAmount: priceWei.toString(),
            endAmount: priceWei.toString(),
          },
        ],
        consideration: [
          {
            itemType: 2, // ERC721
            token: MERGE_CONTRACT_ADDRESS,
            identifierOrCriteria: tokenId.toString(),
            startAmount: '1',
            endAmount: '1',
            recipient: address.value,
          },
          ...feeConsiderations,
        ],
        totalOriginalConsiderationItems: 1 + feeConsiderations.length,
      }

      // 6. Get Seaport counter and sign
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

      // 7. Submit offer to OpenSea
      const result = await $fetch('/api/opensea/post-offer', {
        method: 'POST',
        body: { parameters: orderParameters, signature, protocol_address: SEAPORT_ADDRESS },
      })

      trackEvent('offer_created', { token_id: tokenId, price_eth: priceInEth })
      return { success: true, order: result }
    } catch (err) {
      console.error('[makeOffer]', err)
      const msg = parseTradeError(err)
      if (msg) {
        error.value = msg
        trackEvent('offer_failed', { token_id: tokenId, error_message: msg })
      }
      throw err
    } finally {
      makingOffer.value = false
    }
  }

  // ------------------------------------------------------------------
  // ACCEPT OFFER FLOW
  // ------------------------------------------------------------------
  async function acceptOffer(offer) {
    if (!isConnected.value) throw new Error('Connect wallet first')

    acceptingOffer.value = true
    error.value = null
    txHash.value = null
    trackEvent('accept_offer_initiated', { order_hash: offer.orderHash })

    try {
      const signer = await getSigner()

      // 1. Ensure NFT is approved for OpenSea conduit
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

      // 2. Get fulfillment data from server proxy
      const fulfillmentData = await $fetch('/api/opensea/fulfill-offer', {
        method: 'POST',
        body: {
          orderHash: offer.orderHash,
          protocolAddress: offer.protocolAddress,
          fulfillerAddress: address.value,
        },
      })

      // 3. Extract transaction data and build calldata
      const txData = fulfillmentData.fulfillment_data?.transaction
      if (!txData) throw new Error('No transaction data received')

      console.log('[acceptOffer] function:', txData.function)
      console.log('[acceptOffer] input_data keys:', Object.keys(txData.input_data || {}))

      let seaportCalldata

      if (txData.input_data?.parameters) {
        // Basic order path (fulfillBasicOrder_efficient_6GL6yc)
        const params = txData.input_data.parameters
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
        const seaportIface = new ethers.Interface(SEAPORT_ABI)
        seaportCalldata = seaportIface.encodeFunctionData(
          'fulfillBasicOrder_efficient_6GL6yc', [orderTuple]
        )
      } else if (txData.input_data?.orders) {
        // matchAdvancedOrders path (used for offer fulfillment)
        const d = txData.input_data
        // Convert fulfillments from named objects to positional arrays
        const fulfillments = (d.fulfillments || []).map(f => [
          (f.offerComponents || []).map(c => [c.orderIndex, c.itemIndex]),
          (f.considerationComponents || []).map(c => [c.orderIndex, c.itemIndex]),
        ])
        // Convert orders from named objects to positional arrays
        const orders = d.orders.map(o => [
          [
            o.parameters.offerer, o.parameters.zone,
            (o.parameters.offer || []).map(i => [i.itemType, i.token, i.identifierOrCriteria, i.startAmount, i.endAmount]),
            (o.parameters.consideration || []).map(i => [i.itemType, i.token, i.identifierOrCriteria, i.startAmount, i.endAmount, i.recipient]),
            o.parameters.orderType, o.parameters.startTime, o.parameters.endTime,
            o.parameters.zoneHash, o.parameters.salt, o.parameters.conduitKey,
            o.parameters.totalOriginalConsiderationItems,
          ],
          o.numerator, o.denominator, o.signature, o.extraData,
        ])
        const criteriaResolvers = (d.criteriaResolvers || []).map(r => [
          r.orderIndex, r.side, r.index, r.identifier, r.criteriaProof,
        ])

        const seaportIface = new ethers.Interface(SEAPORT_MATCH_ABI)
        seaportCalldata = seaportIface.encodeFunctionData(
          'matchAdvancedOrders', [orders, criteriaResolvers, fulfillments, d.recipient]
        )
      } else {
        console.error('[acceptOffer] Unknown input_data structure:', txData.input_data)
        throw new Error('Unsupported fulfillment format')
      }

      // 4. Execute the fulfillment transaction
      const tx = await signer.sendTransaction({
        to: txData.to,
        data: seaportCalldata,
        value: BigInt(txData.value || '0'),
      })
      txHash.value = tx.hash
      await tx.wait()

      trackEvent('offer_accepted', { order_hash: offer.orderHash, tx_hash: tx.hash })
      return { success: true, txHash: tx.hash }
    } catch (err) {
      console.error('[acceptOffer]', err)
      const msg = parseTradeError(err)
      if (msg) {
        error.value = msg
        trackEvent('accept_offer_failed', { order_hash: offer.orderHash, error_message: msg })
      }
      throw err
    } finally {
      acceptingOffer.value = false
    }
  }

  // ------------------------------------------------------------------
  // CANCEL LISTING FLOW
  // ------------------------------------------------------------------
  async function cancelListing(orderComponents, protocolAddress) {
    if (!isConnected.value) throw new Error('Connect wallet first')

    cancellingListing.value = true
    error.value = null
    txHash.value = null
    trackEvent('cancel_listing_initiated')

    try {
      const signer = await getSigner()
      const contractAddr = protocolAddress || SEAPORT_ADDRESS

      // Ensure counter is present (OpenSea may omit it)
      if (orderComponents.counter === undefined || orderComponents.counter === null) {
        const provider = await getProvider()
        const seaportRead = new ethers.Contract(
          contractAddr,
          ['function getCounter(address offerer) view returns (uint256)'],
          provider
        )
        orderComponents.counter = await seaportRead.getCounter(orderComponents.offerer)
        console.log('[cancelListing] fetched counter:', orderComponents.counter.toString())
      }

      // Remove totalOriginalConsiderationItems (not part of OrderComponents)
      const { totalOriginalConsiderationItems, ...cleanComponents } = orderComponents

      console.log('[cancelListing] contract:', contractAddr)
      console.log('[cancelListing] components:', JSON.stringify(cleanComponents, null, 2))

      const seaport = new ethers.Contract(contractAddr, SEAPORT_CANCEL_ABI, signer)
      const tx = await seaport.cancel([cleanComponents])
      txHash.value = tx.hash
      await tx.wait()

      trackEvent('listing_cancelled', { tx_hash: tx.hash })
      return { success: true, txHash: tx.hash }
    } catch (err) {
      console.error('[cancelListing]', err)
      const msg = parseTradeError(err)
      if (msg) {
        error.value = msg
        trackEvent('cancel_listing_failed', { error_message: msg })
      }
      throw err
    } finally {
      cancellingListing.value = false
    }
  }

  // ------------------------------------------------------------------
  // TRANSFER (SEND) FLOW
  // ------------------------------------------------------------------
  async function transferToken(tokenId, toAddress) {
    if (!isConnected.value) throw new Error('Connect wallet first')
    if (!toAddress) throw new Error('Address required')

    transferring.value = true
    error.value = null
    txHash.value = null
    trackEvent('transfer_initiated', { token_id: tokenId, to: toAddress })

    try {
      const signer = await getSigner()
      const nftContract = new ethers.Contract(
        MERGE_CONTRACT_ADDRESS,
        [
          'function safeTransferFrom(address from, address to, uint256 tokenId)',
        ],
        signer
      )
      const tx = await nftContract.safeTransferFrom(address.value, toAddress, tokenId)
      txHash.value = tx.hash
      await tx.wait()
      trackEvent('transfer_completed', { token_id: tokenId, to: toAddress, tx_hash: tx.hash })
      return { success: true, txHash: tx.hash }
    } catch (err) {
      const msg = parseTradeError(err)
      if (msg) {
        error.value = msg
        trackEvent('transfer_failed', { token_id: tokenId, error_message: msg })
      }
      throw err
    } finally {
      transferring.value = false
    }
  }

  return {
    buying,
    selling,
    transferring,
    makingOffer,
    acceptingOffer,
    cancellingListing,
    txHash,
    error,
    buyToken,
    sellToken,
    transferToken,
    makeOffer,
    acceptOffer,
    cancelListing,
  }
}

function parseTradeError(err) {
  // User cancelled in wallet — not an error
  // ethers.js uses ACTION_REJECTED, MetaMask raw uses 4001
  if (err.code === 'ACTION_REJECTED' || err.code === 4001 ||
      err.info?.error?.code === 4001 ||
      err.message?.includes('denied') || err.message?.includes('rejected'))
    return null
  // Insufficient ETH
  if (err.code === 'INSUFFICIENT_FUNDS' || err.message?.includes('insufficient funds'))
    return 'Insufficient ETH balance'
  // Server returned error (from $fetch — listing expired, already sold, etc.)
  const status = err.statusCode || err.status || err.data?.statusCode
  if (status === 400 || status === 404)
    return 'Order no longer available'
  if (status >= 500)
    return 'Server error, please try again'
  // Seaport revert (already filled, expired, etc.)
  if (err.code === 'CALL_EXCEPTION')
    return 'Transaction reverted — order may be filled or expired'
  // Network issues
  if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT')
    return 'Network error, please retry'
  // Fallback — include actual message for debugging
  console.warn('[parseTradeError] Unhandled error:', err.message || err)
  return err.shortMessage || err.message || 'Transaction failed'
}

function generateSalt() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
