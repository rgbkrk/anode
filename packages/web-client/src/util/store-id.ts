export const getStoreId = () => {
  if (typeof window === 'undefined') return 'unused'

  const searchParams = new URLSearchParams(window.location.search)
  const storeId = searchParams.get('storeId')
  if (storeId !== null) return storeId

  // Use test-store as default for development
  const defaultStoreId = 'test-store'
  searchParams.set('storeId', defaultStoreId)

  window.location.search = searchParams.toString()
  return defaultStoreId
}
