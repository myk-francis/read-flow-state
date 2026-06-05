import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Library, Settings2 } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { useLibrary } from "@/components/library-provider";
import { UploadDropzone } from "@/components/upload-dropzone";
import { MiniPlayer } from "@/components/mini-player";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReadAlong — Read your EPUBs aloud" },
      { name: "description", content: "A calm, modern EPUB reader that reads books aloud and highlights every line as it goes." },
      { property: "og:title", content: "ReadAlong — Read your EPUBs aloud" },
      { property: "og:description", content: "A calm, modern EPUB reader that reads books aloud and highlights every line as it goes." },
    ],
  }),
  component: Home,
});

function Home() {
  const { books, currentBook, setCurrentBookId } = useLibrary();
  const current = currentBook ?? books[0] ?? null;
  const recent = current ? books.filter((book) => book.id !== current.id).slice(0, 4) : books.slice(0, 4);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
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
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Settings"
            >
              <Settings2 className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-8">
        {/* Hero */}
        <section className="mb-10">
          <div className="rounded-3xl bg-accent p-7 text-accent-foreground shadow-xl shadow-accent/10 sm:p-9">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">
              Welcome back
            </p>
            <h1 className="mt-2 font-serif text-3xl italic leading-tight sm:text-4xl">
              Where would you like to be read to today?
            </h1>
            <div className="mt-7 flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-full bg-paper px-5 py-3 text-sm font-medium text-accent transition-transform hover:scale-[1.02]">
                Open EPUB
                <input
                  type="file"
                  accept=".epub,application/epub+zip"
                  className="sr-only"
                  onChange={() => {}}
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

        {/* Continue reading */}
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
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="w-20 shrink-0">
              <BookCover book={current} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-serif text-lg leading-tight">{current.title}</h3>
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

        {/* Recent */}
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Recent</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.map((b) => (
              <Link
                key={b.id}
                to="/reader/$bookId"
                params={{ bookId: b.id }}
                onClick={() => setCurrentBookId(b.id)}
                className="group block"
              >
                <BookCover book={b} className="transition-transform group-hover:-translate-y-0.5" />
                <p className="mt-3 truncate text-sm font-medium">{b.title}</p>
                <p className="truncate text-xs text-muted-foreground">{b.author}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Import */}
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Add a book</h2>
          </div>
          <UploadDropzone />
        </section>
      </main>

      {current ? <MiniPlayer book={current} /> : null}
    </div>
  );
}
