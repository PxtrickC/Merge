/**
 * Adapts an ethers v6 Signer to the ReservoirWallet interface
 * required by @reservoir0x/reservoir-sdk
 *
 * ReservoirWallet interface:
 *   address: () => Promise<string>
 *   handleSignMessageStep: (item, step) => Promise<string | undefined>
 *   handleSendTransactionStep: (chainId, item, step) => Promise<`0x${string}` | undefined>
 */
export function adaptEthersV6Signer(signer) {
  return {
    // Returns the connected wallet address
    address: async () => {
      return await signer.getAddress()
    },

    // Handles EIP-191 and EIP-712 signature steps
    handleSignMessageStep: async (item) => {
      const sign = item?.data?.sign
      if (!sign) return undefined

      if (sign.signatureKind === "eip191") {
        // Plain message signature
        return await signer.signMessage(sign.message)
      }

      if (sign.signatureKind === "eip712") {
        // Typed data signature (EIP-712)
        // Remove the EIP712Domain entry from types as ethers v6 adds it automatically
        const types = { ...sign.types }
        delete types.EIP712Domain
        return await signer.signTypedData(sign.domain, types, sign.value)
      }

      return undefined
    },

    // Handles on-chain transaction steps (approve, buy, etc.)
    handleSendTransactionStep: async (_chainId, item) => {
      const txData = item?.data
      if (!txData) return undefined

      const tx = await signer.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: txData.value ? BigInt(txData.value) : 0n,
        ...(txData.gas && { gasLimit: BigInt(txData.gas) }),
        ...(txData.maxFeePerGas && { maxFeePerGas: BigInt(txData.maxFeePerGas) }),
        ...(txData.maxPriorityFeePerGas && { maxPriorityFeePerGas: BigInt(txData.maxPriorityFeePerGas) }),
      })

      const receipt = await tx.wait()
      return receipt?.hash
    },
  }
}
