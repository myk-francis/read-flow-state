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
  DEFAULT_READER_SETTINGS,
  type Book,
  type LibraryState,
  type ReaderSettings,
} from "@/lib/books";
import { importEpubFile } from "@/lib/epub-import";
import { loadLibraryState, saveLibraryState } from "@/lib/library-store";

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

function isBook(value: unknown): value is Book {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<Book>;
  return (
    typeof book.id === "string" && typeof book.title === "string" && typeof book.author === "string"
  );
}

function isBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== "object") return false;
  const bookmark = value as Partial<Bookmark>;
  return (
    typeof bookmark.id === "string" &&
    typeof bookmark.bookId === "string" &&
    typeof bookmark.paragraphIndex === "number" &&
    typeof bookmark.text === "string"
  );
}

function isBookNote(value: unknown): value is BookNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<BookNote>;
  return (
    typeof note.id === "string" &&
    typeof note.bookId === "string" &&
    typeof note.paragraphIndex === "number" &&
    typeof note.anchorText === "string" &&
    typeof note.content === "string"
  );
}

function sanitizeState(value: unknown): LibraryState {
  const fallback = createInitialLibraryState();
  if (!value || typeof value !== "object") return fallback;

  const candidate = value as Partial<LibraryState>;
  const books = Array.isArray(candidate.books) ? candidate.books.filter(isBook) : fallback.books;
  const currentBookId =
    typeof candidate.currentBookId === "string" &&
    books.some((book) => book.id === candidate.currentBookId)
      ? candidate.currentBookId
      : (books[0]?.id ?? null);
  const bookmarks = Array.isArray(candidate.bookmarks)
    ? candidate.bookmarks.filter(isBookmark)
    : fallback.bookmarks;
  const notes = Array.isArray(candidate.notes)
    ? candidate.notes.filter(isBookNote)
    : fallback.notes;

  const incomingSettings = candidate.readerSettings as Partial<ReaderSettings> | undefined;
  const readerSettings: ReaderSettings = {
    fontSize:
      typeof incomingSettings?.fontSize === "number"
        ? incomingSettings.fontSize
        : DEFAULT_READER_SETTINGS.fontSize,
    lineHeight:
      typeof incomingSettings?.lineHeight === "number"
        ? incomingSettings.lineHeight
        : DEFAULT_READER_SETTINGS.lineHeight,
    voice:
      typeof incomingSettings?.voice === "string"
        ? incomingSettings.voice
        : DEFAULT_READER_SETTINGS.voice,
    speed:
      typeof incomingSettings?.speed === "number"
        ? incomingSettings.speed
        : DEFAULT_READER_SETTINGS.speed,
    theme:
      incomingSettings?.theme === "dark" || incomingSettings?.theme === "light"
        ? incomingSettings.theme
        : DEFAULT_READER_SETTINGS.theme,
    highlight:
      incomingSettings?.highlight === "soft" ||
      incomingSettings?.highlight === "underline" ||
      incomingSettings?.highlight === "bar"
        ? incomingSettings.highlight
        : DEFAULT_READER_SETTINGS.highlight,
  };

  return { books, currentBookId, readerSettings, bookmarks, notes };
}

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
          setState(sanitizeState(stored));
          return;
        }

        if (typeof window !== "undefined") {
          const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const migrated = sanitizeState(JSON.parse(legacy));
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
    setState((current) => {
      if (current.currentBookId === bookId) {
        return current;
      }

      return {
        ...current,
        currentBookId: bookId,
        books: current.books.map((book) =>
          book.id === bookId ? { ...book, lastOpenedAt: new Date().toISOString() } : book,
        ),
      };
    });
  }, []);

  const updateBook = useCallback((bookId: string, updater: (book: Book) => Book) => {
    setState((current) => ({
      ...current,
      books: current.books.map((book) => (book.id === bookId ? updater(book) : book)),
    }));
  }, []);

  const setReaderSettings = useCallback((next: ReaderSettings) => {
    setState((current) => ({ ...current, readerSettings: next }));
  }, []);

  const importBook = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const { assetId, book } = await importEpubFile(file);
      await saveBookAsset(assetId, file);

      setState((current) => {
        const existingIndex = current.books.findIndex((entry) => entry.id === book.id);
        const books =
          existingIndex >= 0
            ? current.books.map((entry) => (entry.id === book.id ? book : entry))
            : [book, ...current.books.filter((entry) => entry.id !== book.id)];

        return {
          ...current,
          books,
          currentBookId: book.id,
        };
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

      setState((current) => {
        const books = current.books.filter((book) => book.id !== bookId);
        const currentBookId =
          current.currentBookId === bookId ? (books[0]?.id ?? null) : current.currentBookId;

        return {
          ...current,
          books,
          currentBookId,
          bookmarks: current.bookmarks.filter((bookmark) => bookmark.bookId !== bookId),
          notes: current.notes.filter((note) => note.bookId !== bookId),
        };
      });
    },
    [state.books],
  );

  const toggleBookmark = useCallback((bookmark: Omit<Bookmark, "id" | "createdAt">) => {
    setState((current) => {
      const existing = current.bookmarks.find(
        (entry) =>
          entry.bookId === bookmark.bookId &&
          entry.sectionHref === bookmark.sectionHref &&
          entry.paragraphIndex === bookmark.paragraphIndex,
      );

      if (existing) {
        return {
          ...current,
          bookmarks: current.bookmarks.filter((entry) => entry.id !== existing.id),
        };
      }

      return {
        ...current,
        bookmarks: [
          {
            ...bookmark,
            id: `bookmark-${crypto.randomUUID()}`,
            createdAt: new Date().toISOString(),
          },
          ...current.bookmarks,
        ],
      };
    });
  }, []);

  const saveNote = useCallback((note: Omit<BookNote, "id" | "createdAt" | "updatedAt">) => {
    setState((current) => {
      const existing = current.notes.find(
        (entry) =>
          entry.bookId === note.bookId &&
          entry.sectionHref === note.sectionHref &&
          entry.paragraphIndex === note.paragraphIndex,
      );
      const timestamp = new Date().toISOString();

      if (existing) {
        return {
          ...current,
          notes: current.notes.map((entry) =>
            entry.id === existing.id
              ? {
                  ...entry,
                  anchorText: note.anchorText,
                  content: note.content,
                  updatedAt: timestamp,
                }
              : entry,
          ),
        };
      }

      return {
        ...current,
        notes: [
          {
            ...note,
            id: `note-${crypto.randomUUID()}`,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...current.notes,
        ],
      };
    });
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    setState((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== noteId),
    }));
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
