export function useTokenDrawer() {
  const tokenId = useState('drawerTokenId', () => null)
  const isOpen = useState('drawerIsOpen', () => false)
  const listing = useState('drawerListing', () => null)

  function open(id, listingData = null) {
    tokenId.value = +id
    listing.value = listingData
    isOpen.value = true
    const { trackEvent } = useAnalytics()
    trackEvent('token_drawer_opened', { token_id: +id })
  }

  function close() {
    isOpen.value = false
  }

  return { tokenId, isOpen, listing, open, close }
}
