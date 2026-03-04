export function useTokenDrawer() {
  const tokenId = useState('drawerTokenId', () => null)
  const isOpen = useState('drawerIsOpen', () => false)
  const listing = useState('drawerListing', () => null)
  const initialTokenData = useState('drawerInitialData', () => null)
  const _savedPath = useState('drawerSavedPath', () => null)

  function open(id, listingData = null, tokenData = null) {
    tokenId.value = +id
    listing.value = listingData
    initialTokenData.value = tokenData
    isOpen.value = true

    // Update URL without navigation for shareability
    if (import.meta.client) {
      const target = `/${id}`
      if (window.location.pathname !== target) {
        if (!_savedPath.value) _savedPath.value = window.location.pathname + window.location.search
        history.replaceState(null, '', target)
      }
    }

    const { trackEvent } = useAnalytics()
    trackEvent('token_drawer_opened', { token_id: +id })
  }

  function close() {
    isOpen.value = false
    initialTokenData.value = null

    // Restore original URL
    if (import.meta.client && _savedPath.value) {
      history.replaceState(null, '', _savedPath.value)
      _savedPath.value = null
    }
  }

  return { tokenId, isOpen, listing, initialTokenData, open, close }
}
