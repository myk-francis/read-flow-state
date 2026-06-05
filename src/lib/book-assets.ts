import localforage from "localforage";

const bookAssetStore = localforage.createInstance({
  name: "read-flow-state",
  storeName: "epub_assets",
});
const inMemoryAssetCache = new Map<string, Blob>();

export async function saveBookAsset(assetId: string, file: Blob) {
  inMemoryAssetCache.set(assetId, file);
  await bookAssetStore.setItem(assetId, file);
}

export async function loadBookAsset(assetId: string) {
  const cached = inMemoryAssetCache.get(assetId);
  if (cached) {
    return cached;
  }

  const file = await bookAssetStore.getItem<Blob>(assetId);
  if (file) {
    inMemoryAssetCache.set(assetId, file);
  }
  return file ?? null;
}

export async function removeBookAsset(assetId: string) {
  inMemoryAssetCache.delete(assetId);
  await bookAssetStore.removeItem(assetId);
}
