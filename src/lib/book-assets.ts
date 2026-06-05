import localforage from "localforage";

const bookAssetStore = localforage.createInstance({
  name: "read-flow-state",
  storeName: "epub_assets",
});

export async function saveBookAsset(assetId: string, file: Blob) {
  await bookAssetStore.setItem(assetId, file);
}

export async function loadBookAsset(assetId: string) {
  const file = await bookAssetStore.getItem<Blob>(assetId);
  return file ?? null;
}

export async function removeBookAsset(assetId: string) {
  await bookAssetStore.removeItem(assetId);
}
