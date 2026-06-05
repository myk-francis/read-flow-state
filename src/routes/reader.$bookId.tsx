import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Moon,
  Pause,
  Play,
  Settings2,
  Sun,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EpubViewer } from "@/components/epub-viewer";
import { useLibrary } from "@/components/library-provider";
import { SettingsSheet } from "@/components/settings-sheet";
import { loadBookAsset } from "@/lib/book-assets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reader/$bookId")({
  head: () => ({
    meta: [{ title: "Reader - ReadAlong" }, { name: "description", content: "ReadAlong reader" }],
  }),
  component: ReaderPage,
});

function ReaderPage() {
  const { bookId } = Route.useParams();
  const { books, readerSettings, setCurrentBookId, setReaderSettings, updateBook } = useLibrary();
  const [playing, setPlaying] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const book = books.find((entry) => entry.id === bookId) ?? null;

  useEffect(() => {
    if (!book) return;
    if (book) {
      setCurrentBookId(book.id);
    }
  }, [book, setCurrentBookId]);

  useEffect(() => {
    const root = document.documentElement;
    if (readerSettings.theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    return () => root.classList.remove("dark");
  }, [readerSettings.theme]);

  useEffect(() => {
    let cancelled = false;

    const loadSource = async () => {
      if (!book || book.source.kind !== "local" || !book.source.assetId) {
        setBookData(null);
        return;
      }

      const asset = await loadBookAsset(book.source.assetId);
      if (!asset || cancelled) {
        if (!cancelled) setBookData(null);
        return;
      }

      const buffer = await asset.arrayBuffer();
      if (!cancelled) {
        setBookData(buffer);
      }
    };

    void loadSource();

    return () => {
      cancelled = true;
    };
  }, [book]);

  const activeLine = book?.activeLine ?? 0;

  const setActiveLine = (nextLineOrUpdater: number | ((line: number) => number)) => {
    if (!book) return;
    updateBook(book.id, (currentBook) => {
      const nextLine =
        typeof nextLineOrUpdater === "function"
          ? nextLineOrUpdater(currentBook.activeLine)
          : nextLineOrUpdater;

      return {
        ...currentBook,
        activeLine: Math.max(0, Math.min(currentBook.excerpt.length - 1, nextLine)),
      };
    });
  };

  useEffect(() => {
    if (!book || !playing) return;
    const interval = 3800 / readerSettings.speed;
    const id = window.setInterval(() => {
      setActiveLine((line) => (line + 1) % book.excerpt.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [book, playing, readerSettings.speed]);

  useEffect(() => {
    if (!book) return;
    const el = lineRefs.current[activeLine];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLine, book]);

  if (!book) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div>
          <p className="font-serif text-2xl italic">We couldn't find that book.</p>
          <Link to="/library" className="mt-4 inline-block text-sm font-medium text-accent">
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  const progress = (activeLine + 1) / book.excerpt.length;
  const minutesIn = Math.round(progress * 22);
  const minutesLeft = 22 - minutesIn;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link
            to="/library"
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Back to library"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {book.chapter}
            </p>
            <p className="font-serif text-sm italic">{book.title}</p>
          </div>
          <button
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Bookmark"
          >
            <Bookmark className="size-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-48 pt-10 sm:px-8 sm:pt-16">
        {book.source.kind === "local" && bookData ? (
          <EpubViewer
            source={bookData}
            className="mx-auto max-w-5xl"
            initialLocationCfi={book.locationCfi}
            onLocationChange={(location) => {
              updateBook(book.id, (currentBook) => ({
                ...currentBook,
                locationCfi: location.cfi ?? currentBook.locationCfi,
                locationHref: location.href ?? currentBook.locationHref,
                progress:
                  typeof location.percentage === "number"
                    ? Math.max(0, Math.min(1, location.percentage))
                    : currentBook.progress,
              }));
            }}
          />
        ) : (
          <article
            className="mx-auto max-w-[60ch] space-y-7 font-serif"
            style={{ fontSize: readerSettings.fontSize, lineHeight: readerSettings.lineHeight }}
          >
            {book.excerpt.map((line, i) => {
              const active = i === activeLine;
              return (
                <p
                  key={i}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  onClick={() => setActiveLine(i)}
                  data-active={active}
                  className={cn(
                    "cursor-pointer text-pretty",
                    readerSettings.highlight === "soft" && "reading-line",
                    readerSettings.highlight === "underline" &&
                      (active
                        ? "underline decoration-accent decoration-2 underline-offset-[6px]"
                        : "text-foreground/45"),
                    readerSettings.highlight === "bar" &&
                      (active
                        ? "border-l-2 border-accent pl-3"
                        : "border-l-2 border-transparent pl-3 text-foreground/45"),
                  )}
                >
                  {line}
                </p>
              );
            })}
          </article>
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="pointer-events-auto mx-auto max-w-lg rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="w-10 text-[10px] font-medium uppercase tracking-widest tabular-nums text-muted-foreground">
              {minutesIn}m
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-[10px] font-medium uppercase tracking-widest tabular-nums text-muted-foreground">
              -{minutesLeft}m
            </span>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                setReaderSettings({
                  ...readerSettings,
                  speed:
                    readerSettings.speed >= 1.75
                      ? 0.8
                      : Math.round((readerSettings.speed + 0.25) * 100) / 100,
                })
              }
              className="min-w-12 rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground hover:text-foreground"
              aria-label="Reading speed"
            >
              {readerSettings.speed}x
            </button>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setActiveLine((line) => line - 1)}
                className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Previous line"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                onClick={() => setPlaying((isPlaying) => !isPlaying)}
                className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform hover:scale-[1.03] active:scale-95"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
              </button>
              <button
                onClick={() => setActiveLine((line) => line + 1)}
                className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Next line"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setReaderSettings({
                    ...readerSettings,
                    theme: readerSettings.theme === "dark" ? "light" : "dark",
                  })
                }
                className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Toggle theme"
              >
                {readerSettings.theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Settings"
              >
                <Settings2 className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={readerSettings}
        onChange={setReaderSettings}
      />
    </div>
  );
}
