import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { SettingsSheet } from "@/components/settings-sheet";
import { useLibrary } from "@/components/library-provider";
import { readAvailableVoiceNames } from "@/lib/speech";

export const Route = createFileRoute("/library/")({
  head: () => ({
    meta: [
      { title: "Library — ReadAlong" },
      { name: "description", content: "Your imported EPUB books, organized for calm browsing." },
      { property: "og:title", content: "Library — ReadAlong" },
      {
        property: "og:description",
        content: "Your imported EPUB books, organized for calm browsing.",
      },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { books, readerSettings, removeBook, setCurrentBookId, setReaderSettings } = useLibrary();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "reading" | "finished" | "unread">("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAvailableVoices([]);
      return;
    }

    const readVoices = () => {
      setAvailableVoices(readAvailableVoiceNames());
    };

    readVoices();
    window.speechSynthesis.addEventListener("voiceschanged", readVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", readVoices);
  }, []);

  const filtered = useMemo(() => {
    return books.filter((b) => {
      const q = query.trim().toLowerCase();
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) {
        return false;
      }
      if (filter === "reading") return b.progress > 0 && b.progress < 1;
      if (filter === "finished") return b.progress >= 1;
      if (filter === "unread") return b.progress === 0;
      return true;
    });
  }, [books, filter, query]);

  const handleDeleteBook = async (bookId: string, title: string) => {
    const confirmed = window.confirm(`Delete "${title}" from your library?`);
    if (!confirmed) return;
    await removeBook(bookId);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-5">
          <Link
            to="/"
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="flex-1 text-base font-semibold tracking-tight">Library</h1>
          <div className="flex items-center gap-1">
            <button
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Filters"
            >
              <SlidersHorizontal className="size-5" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Settings"
            >
              <Settings2 className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-6">
        {/* Search */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles or authors"
            className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Filter chips */}
        <div className="mb-7 flex flex-wrap gap-2">
          {(["all", "reading", "unread", "finished"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition-colors " +
                (filter === f
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:bg-muted")
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-serif text-xl italic text-muted-foreground">Nothing here yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different search or import a new EPUB.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((b) => (
              <div key={b.id} className="group relative">
                <Link
                  to="/reader/$bookId"
                  params={{ bookId: b.id }}
                  onClick={() => setCurrentBookId(b.id)}
                  className="block"
                >
                  <BookCover
                    book={b}
                    className="transition-transform group-hover:-translate-y-0.5"
                  />
                  <p className="mt-3 truncate pr-10 text-sm font-medium">{b.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.author}</p>
                  <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-accent" style={{ width: `${b.progress * 100}%` }} />
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDeleteBook(b.id, b.title)}
                  className="absolute right-0 top-0 grid size-8 place-items-center rounded-full border border-border bg-background/95 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  aria-label={`Delete ${b.title}`}
                  title={`Delete ${b.title}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={readerSettings}
        onChange={setReaderSettings}
        voices={availableVoices}
      />
    </div>
  );
}
