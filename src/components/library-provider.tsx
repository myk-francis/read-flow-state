import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { removeBookAsset, saveBookAsset } from "@/lib/book-assets";
import {
  type BookNote,
  type Bookmark,
  createInitialLibraryState,
  type Book,
  type ReaderSettings,
} from "@/lib/books";
import { importEpubFile } from "@/lib/epub-import";
import {
  deleteNoteFromState,
  mergeImportedBookInState,
  removeBookFromState,
  sanitizeLibraryState,
  saveNoteInState,
  setCurrentBookInState,
  setReaderSettingsInState,
  toggleBookmarkInState,
  updateBookInState,
} from "@/lib/library-state";
import { loadLibraryState, saveLibraryState } from "@/lib/library-store";
import type { LibraryState } from "@/lib/books";

const LEGACY_STORAGE_KEY = "read-flow-state/library-v1";

interface LibraryContextValue {
  books: Book[];
  currentBook: Book | null;
  currentBookId: string | null;
  readerSettings: ReaderSettings;
  bookmarks: Bookmark[];
  notes: BookNote[];
  hydrated: boolean;
  importing: boolean;
  setCurrentBookId: (bookId: string) => void;
  updateBook: (bookId: string, updater: (book: Book) => Book) => void;
  setReaderSettings: (next: ReaderSettings) => void;
  importBook: (file: File) => Promise<Book>;
  removeBook: (bookId: string) => Promise<void>;
  toggleBookmark: (bookmark: Omit<Bookmark, "id" | "createdAt">) => void;
  saveNote: (note: Omit<BookNote, "id" | "createdAt" | "updatedAt">) => void;
  deleteNote: (noteId: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(createInitialLibraryState);
  const [hydrated, setHydrated] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const hydrateState = async () => {
      try {
        const stored = await loadLibraryState();
        if (!cancelled && stored) {
          setState(sanitizeLibraryState(stored));
          return;
        }

        if (typeof window !== "undefined") {
          const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const migrated = sanitizeLibraryState(JSON.parse(legacy));
            await saveLibraryState(migrated);
            window.localStorage.removeItem(LEGACY_STORAGE_KEY);
            if (!cancelled) {
              setState(migrated);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load library state", error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void hydrateState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    void saveLibraryState(state);
  }, [hydrated, state]);

  const setCurrentBookId = useCallback((bookId: string) => {
    setState((current) => setCurrentBookInState(current, bookId));
  }, []);

  const updateBook = useCallback((bookId: string, updater: (book: Book) => Book) => {
    setState((current) => updateBookInState(current, bookId, updater));
  }, []);

  const setReaderSettings = useCallback((next: ReaderSettings) => {
    setState((current) => setReaderSettingsInState(current, next));
  }, []);

  const importBook = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const { assetId, book } = await importEpubFile(file);
      await saveBookAsset(assetId, file);

      setState((current) => {
        return mergeImportedBookInState(current, book);
      });

      return book;
    } finally {
      setImporting(false);
    }
  }, []);

  const removeBook = useCallback(
    async (bookId: string) => {
      const target = state.books.find((book) => book.id === bookId);
      if (!target) return;

      if (target.source.kind === "local" && target.source.assetId) {
        await removeBookAsset(target.source.assetId);
      }

      setState((current) => removeBookFromState(current, bookId));
    },
    [state.books],
  );

  const toggleBookmark = useCallback((bookmark: Omit<Bookmark, "id" | "createdAt">) => {
    setState((current) => toggleBookmarkInState(current, bookmark));
  }, []);

  const saveNote = useCallback((note: Omit<BookNote, "id" | "createdAt" | "updatedAt">) => {
    setState((current) => saveNoteInState(current, note));
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    setState((current) => deleteNoteFromState(current, noteId));
  }, []);

  const value = useMemo<LibraryContextValue>(() => {
    const currentBook = state.books.find((book) => book.id === state.currentBookId) ?? null;
    return {
      books: state.books,
      currentBook,
      currentBookId: state.currentBookId,
      readerSettings: state.readerSettings,
      bookmarks: state.bookmarks,
      notes: state.notes,
      hydrated,
      importing,
      setCurrentBookId,
      updateBook,
      setReaderSettings,
      importBook,
      removeBook,
      toggleBookmark,
      saveNote,
      deleteNote,
    };
  }, [
    deleteNote,
    hydrated,
    importBook,
    importing,
    removeBook,
    saveNote,
    setCurrentBookId,
    setReaderSettings,
    state,
    toggleBookmark,
    updateBook,
  ]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used within LibraryProvider");
  }
  return context;
}
