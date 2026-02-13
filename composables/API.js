export async function useAPI(path = "") {
    if (!path.length) throw '💥 API path is empty'

    return (await useLazyFetch(`/data${path}.json`, {})).data
}
