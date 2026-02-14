export function useTokenDrawer() {
  const tokenId = useState('drawerTokenId', () => null)
  const isOpen = useState('drawerIsOpen', () => false)

  function open(id) {
    tokenId.value = +id
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return { tokenId, isOpen, open, close }
}
