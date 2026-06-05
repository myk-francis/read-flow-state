import localforage from "localforage";
import type { LibraryState } from "@/lib/books";

const libraryStateStore = localforage.createInstance({
  name: "read-flow-state",
  storeName: "library_state",
});

const LIBRARY_STATE_KEY = "library-v2";

export async function loadLibraryState() {
  return (await libraryStateStore.getItem<LibraryState>(LIBRARY_STATE_KEY)) ?? null;
}

export async function saveLibraryState(state: LibraryState) {
  await libraryStateStore.setItem(LIBRARY_STATE_KEY, state);
}
