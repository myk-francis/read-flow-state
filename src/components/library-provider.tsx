import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createInitialLibraryState,
  DEFAULT_READER_SETTINGS,
  type Book,
  type LibraryState,
  type ReaderSettings,
} from "@/lib/books";

const STORAGE_KEY = "read-flow-state/library-v1";

interface LibraryContextValue {
  books: Book[];
  currentBook: Book | null;
  currentBookId: string | null;
  readerSettings: ReaderSettings;
  hydrated: boolean;
  setCurrentBookId: (bookId: string) => void;
  updateBook: (bookId: string, updater: (book: Book) => Book) => void;
  setReaderSettings: (next: ReaderSettings) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function isBook(value: unknown): value is Book {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<Book>;
  return typeof book.id === "string" && typeof book.title === "string" && typeof book.author === "string";
}

function sanitizeState(value: unknown): LibraryState {
  const fallback = createInitialLibraryState();
  if (!value || typeof value !== "object") return fallback;

  const candidate = value as Partial<LibraryState>;
  const books = Array.isArray(candidate.books) ? candidate.books.filter(isBook) : fallback.books;
  const currentBookId =
    typeof candidate.currentBookId === "string" && books.some((book) => book.id === candidate.currentBookId)
      ? candidate.currentBookId
      : books[0]?.id ?? null;

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

  return { books, currentBookId, readerSettings };
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(createInitialLibraryState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState(sanitizeState(JSON.parse(raw)));
      }
    } catch (error) {
      console.error("Failed to load library state", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const setCurrentBookId = useCallback((bookId: string) => {
    setState((current) => ({
      ...current,
      currentBookId: bookId,
      books: current.books.map((book) =>
        book.id === bookId ? { ...book, lastOpenedAt: new Date().toISOString() } : book,
      ),
    }));
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

  const value = useMemo<LibraryContextValue>(() => {
    const currentBook = state.books.find((book) => book.id === state.currentBookId) ?? null;
    return {
      books: state.books,
      currentBook,
      currentBookId: state.currentBookId,
      readerSettings: state.readerSettings,
      hydrated,
      setCurrentBookId,
      updateBook,
      setReaderSettings,
    };
  }, [hydrated, setCurrentBookId, setReaderSettings, state, updateBook]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used within LibraryProvider");
  }
  return context;
}
