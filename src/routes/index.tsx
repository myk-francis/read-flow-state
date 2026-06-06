import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Library, LoaderCircle, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { useLibrary } from "@/components/library-provider";
import { SettingsSheet } from "@/components/settings-sheet";
import { MiniPlayer } from "@/components/mini-player";
import { UploadDropzone } from "@/components/upload-dropzone";
import { readAvailableVoiceNames } from "@/lib/speech";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReadAlong - Read your EPUBs aloud" },
      {
        name: "description",
        content:
          "A calm, modern EPUB reader that reads books aloud and highlights every line as it goes.",
      },
      { property: "og:title", content: "ReadAlong - Read your EPUBs aloud" },
      {
        property: "og:description",
        content:
          "A calm, modern EPUB reader that reads books aloud and highlights every line as it goes.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const {
    books,
    currentBook,
    importing,
    importBook,
    readerSettings,
    setCurrentBookId,
    setReaderSettings,
  } = useLibrary();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  const current = currentBook ?? books[0] ?? null;
  const recent = current
    ? books.filter((book) => book.id !== current.id).slice(0, 4)
    : books.slice(0, 4);

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

  const handleSelectedFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imported = await importBook(files[0]);
    await navigate({
      to: "/reader/$bookId",
      params: { bookId: imported.id },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
              <div className="h-0.5 w-4 rounded-full bg-current" />
            </div>
            <span className="text-lg font-semibold tracking-tight">ReadAlong</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/library"
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Library"
            >
              <Library className="size-5" />
            </Link>
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

      <main className="mx-auto max-w-2xl px-4 pt-6 sm:px-5 sm:pt-8">
        <section className="mb-10">
          <div className="rounded-3xl bg-accent p-6 text-accent-foreground shadow-xl shadow-accent/10 sm:p-9">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">
              Welcome back
            </p>
            <h1 className="mt-2 text-balance font-serif text-2xl italic leading-tight sm:text-4xl">
              Where would you like to be read to today?
            </h1>
            <div className="mt-7 flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-full bg-paper px-5 py-3 text-sm font-medium text-accent transition-transform hover:scale-[1.02]">
                <span className="inline-flex items-center gap-2">
                  {importing ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {importing ? "Importing EPUB" : "Open EPUB"}
                </span>
                <input
                  type="file"
                  accept=".epub,application/epub+zip"
                  className="sr-only"
                  onChange={(event) => void handleSelectedFiles(event.target.files)}
                />
              </label>
              {current ? (
                <Link
                  to="/reader/$bookId"
                  params={{ bookId: current.id }}
                  onClick={() => setCurrentBookId(current.id)}
                  className="rounded-full border border-accent-foreground/30 px-5 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-foreground/10"
                >
                  Continue reading
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {current ? (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Continue reading</h2>
              <Link to="/library" className="text-sm font-medium text-accent">
                View all
              </Link>
            </div>

            <Link
              to="/reader/$bookId"
              params={{ bookId: current.id }}
              onClick={() => setCurrentBookId(current.id)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/50 sm:gap-4 sm:p-4"
            >
              <div className="w-18 shrink-0 sm:w-20">
                <BookCover book={current} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-serif text-base leading-tight sm:text-lg">
                  {current.title}
                </h3>
                <p className="truncate text-sm text-muted-foreground">{current.author}</p>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${current.progress * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {Math.round(current.progress * 100)}% • {current.chapter}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </section>
        ) : null}

        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Recent</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.map((book) => (
              <Link
                key={book.id}
                to="/reader/$bookId"
                params={{ bookId: book.id }}
                onClick={() => setCurrentBookId(book.id)}
                className="group block"
              >
                <BookCover
                  book={book}
                  className="transition-transform group-hover:-translate-y-0.5"
                />
                <p className="mt-3 truncate text-sm font-medium">{book.title}</p>
                <p className="truncate text-xs text-muted-foreground">{book.author}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Add a book</h2>
          </div>
          <UploadDropzone onSelectFiles={(files) => void handleSelectedFiles(files)} />
        </section>
      </main>

      {current ? <MiniPlayer book={current} /> : null}

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
