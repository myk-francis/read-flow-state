import {
  createInitialLibraryState,
  DEFAULT_READER_SETTINGS,
  type Book,
  type BookNote,
  type Bookmark,
  type LibraryState,
  type ReaderSettings,
} from "@/lib/books";

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

export function sanitizeLibraryState(value: unknown): LibraryState {
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
    textUnit:
      incomingSettings?.textUnit === "paragraphs" || incomingSettings?.textUnit === "sentences"
        ? incomingSettings.textUnit
        : DEFAULT_READER_SETTINGS.textUnit,
  };

  return { books, currentBookId, readerSettings, bookmarks, notes };
}

export function setCurrentBookInState(state: LibraryState, bookId: string): LibraryState {
  if (state.currentBookId === bookId) {
    return state;
  }

  return {
    ...state,
    currentBookId: bookId,
    books: state.books.map((book) =>
      book.id === bookId ? { ...book, lastOpenedAt: new Date().toISOString() } : book,
    ),
  };
}

export function updateBookInState(
  state: LibraryState,
  bookId: string,
  updater: (book: Book) => Book,
): LibraryState {
  return {
    ...state,
    books: state.books.map((book) => (book.id === bookId ? updater(book) : book)),
  };
}

export function setReaderSettingsInState(
  state: LibraryState,
  readerSettings: ReaderSettings,
): LibraryState {
  return { ...state, readerSettings };
}

export function mergeImportedBookInState(state: LibraryState, book: Book): LibraryState {
  const existingIndex = state.books.findIndex((entry) => entry.id === book.id);
  const books =
    existingIndex >= 0
      ? state.books.map((entry) => (entry.id === book.id ? book : entry))
      : [book, ...state.books.filter((entry) => entry.id !== book.id)];

  return {
    ...state,
    books,
    currentBookId: book.id,
  };
}

export function removeBookFromState(state: LibraryState, bookId: string): LibraryState {
  const books = state.books.filter((book) => book.id !== bookId);
  const currentBookId =
    state.currentBookId === bookId ? (books[0]?.id ?? null) : state.currentBookId;

  return {
    ...state,
    books,
    currentBookId,
    bookmarks: state.bookmarks.filter((bookmark) => bookmark.bookId !== bookId),
    notes: state.notes.filter((note) => note.bookId !== bookId),
  };
}

export function toggleBookmarkInState(
  state: LibraryState,
  bookmark: Omit<Bookmark, "id" | "createdAt">,
): LibraryState {
  const existing = state.bookmarks.find(
    (entry) =>
      entry.bookId === bookmark.bookId &&
      entry.sectionHref === bookmark.sectionHref &&
      entry.paragraphIndex === bookmark.paragraphIndex,
  );

  if (existing) {
    return {
      ...state,
      bookmarks: state.bookmarks.filter((entry) => entry.id !== existing.id),
    };
  }

  return {
    ...state,
    bookmarks: [
      {
        ...bookmark,
        id: `bookmark-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
      },
      ...state.bookmarks,
    ],
  };
}

export function saveNoteInState(
  state: LibraryState,
  note: Omit<BookNote, "id" | "createdAt" | "updatedAt">,
): LibraryState {
  const existing = state.notes.find(
    (entry) =>
      entry.bookId === note.bookId &&
      entry.sectionHref === note.sectionHref &&
      entry.paragraphIndex === note.paragraphIndex,
  );
  const timestamp = new Date().toISOString();

  if (existing) {
    return {
      ...state,
      notes: state.notes.map((entry) =>
        entry.id === existing.id
          ? {
              ...entry,
              anchorText: note.anchorText,
              content: note.content,
              pageIndex: note.pageIndex,
              updatedAt: timestamp,
            }
          : entry,
      ),
    };
  }

  return {
    ...state,
    notes: [
      {
        ...note,
        id: `note-${crypto.randomUUID()}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...state.notes,
    ],
  };
}

export function deleteNoteFromState(state: LibraryState, noteId: string): LibraryState {
  return {
    ...state,
    notes: state.notes.filter((note) => note.id !== noteId),
  };
}
