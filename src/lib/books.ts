export type BookCoverTone = "warm" | "cool" | "sage" | "ink";

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  voice: string;
  speed: number;
  theme: "light" | "dark";
  highlight: "soft" | "underline" | "bar";
}

export interface BookSource {
  kind: "demo" | "local";
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  assetId?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  progress: number;
  chapter: string;
  coverHue: number;
  coverTone: BookCoverTone;
  excerpt: string[];
  activeLine: number;
  importedAt: string;
  lastOpenedAt?: string;
  source: BookSource;
}

export interface LibraryState {
  books: Book[];
  currentBookId: string | null;
  readerSettings: ReaderSettings;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 19,
  lineHeight: 1.65,
  voice: "Evelyn (Natural)",
  speed: 1,
  theme: "light",
  highlight: "soft",
};

const now = "2026-06-05T08:00:00.000Z";

export const demoBooks: Book[] = [
  {
    id: "moveable-feast",
    title: "A Moveable Feast",
    author: "Ernest Hemingway",
    progress: 0.42,
    chapter: "Chapter IV",
    coverHue: 28,
    coverTone: "warm",
    activeLine: 2,
    importedAt: now,
    lastOpenedAt: now,
    source: { kind: "demo" },
    excerpt: [
      "When spring came, even the false spring, there were no problems except where to be happiest.",
      "The only thing that could spoil a day was people, and if you could keep from making engagements, each day had no limits.",
      "People were always the limiters of happiness except for the very few that were as good as spring itself.",
      "You ate well and cheaply and you drank well and cheaply and you slept well and warm together and loved each other.",
      "There was the park of the Buttes-Chaumont where it was always quiet and few people went and the air was different from the rest of the city.",
      "It was a fine place to walk in the afternoons when you wanted to think clearly about what you had been writing.",
    ],
  },
  {
    id: "meditations",
    title: "Meditations",
    author: "Marcus Aurelius",
    progress: 0.65,
    chapter: "Book III",
    coverHue: 150,
    coverTone: "sage",
    activeLine: 1,
    importedAt: now,
    source: { kind: "demo" },
    excerpt: [
      "From my mother I learned piety and beneficence, and abstinence not only from evil deeds but even from evil thoughts.",
      "Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial.",
      "All these things happen to them by reason of their ignorance of what is good and evil.",
    ],
  },
  {
    id: "gatsby",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    progress: 0.18,
    chapter: "Chapter I",
    coverHue: 215,
    coverTone: "cool",
    activeLine: 0,
    importedAt: now,
    source: { kind: "demo" },
    excerpt: [
      "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.",
      "Whenever you feel like criticizing any one, just remember that all the people in this world haven't had the advantages that you've had.",
    ],
  },
  {
    id: "walden",
    title: "Walden",
    author: "Henry David Thoreau",
    progress: 0,
    chapter: "Economy",
    coverHue: 130,
    coverTone: "sage",
    activeLine: 0,
    importedAt: now,
    source: { kind: "demo" },
    excerpt: [
      "I went to the woods because I wished to live deliberately, to front only the essential facts of life.",
    ],
  },
  {
    id: "little-prince",
    title: "The Little Prince",
    author: "Antoine de Saint-Exupery",
    progress: 0.88,
    chapter: "Chapter XXI",
    coverHue: 200,
    coverTone: "cool",
    activeLine: 0,
    importedAt: now,
    source: { kind: "demo" },
    excerpt: [
      "It is the time you have wasted for your rose that makes your rose so important.",
    ],
  },
  {
    id: "ulysses",
    title: "Ulysses",
    author: "James Joyce",
    progress: 0.04,
    chapter: "Telemachus",
    coverHue: 0,
    coverTone: "ink",
    activeLine: 0,
    importedAt: now,
    source: { kind: "demo" },
    excerpt: [
      "Stately, plump Buck Mulligan came from the stairhead, bearing a bowl of lather on which a mirror and a razor lay crossed.",
    ],
  },
];

export function createInitialLibraryState(): LibraryState {
  return {
    books: demoBooks,
    currentBookId: demoBooks[0]?.id ?? null,
    readerSettings: DEFAULT_READER_SETTINGS,
  };
}
