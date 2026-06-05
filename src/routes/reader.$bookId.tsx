import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Settings2,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getBook, type Book } from "@/lib/books";
import { SettingsSheet, type ReaderSettings } from "@/components/settings-sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reader/$bookId")({
  loader: ({ params }) => {
    const book = getBook(params.bookId);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.book.title ?? "Reader"} — ReadFlow` },
      {
        name: "description",
        content: loaderData?.book
          ? `Listen to ${loaderData.book.title} by ${loaderData.book.author} with synchronized highlighting.`
          : "ReadFlow reader",
      },
    ],
  }),
  component: ReaderPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <p className="font-serif text-2xl italic">We couldn't find that book.</p>
        <Link to="/library" className="mt-4 inline-block text-sm font-medium text-accent">
          Back to library
        </Link>
      </div>
    </div>
  ),
});

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 19,
  lineHeight: 1.65,
  voice: "Evelyn (Natural)",
  speed: 1,
  theme: "light",
  highlight: "soft",
};

function ReaderPage() {
  const { book } = Route.useLoaderData() as { book: Book };
  const [activeLine, setActiveLine] = useState(book.activeLine);
  const [playing, setPlaying] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Toggle dark theme on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    return () => root.classList.remove("dark");
  }, [settings.theme]);

  // Auto-advance highlighted line while "playing"
  useEffect(() => {
    if (!playing) return;
    const interval = 3800 / settings.speed;
    const id = window.setInterval(() => {
      setActiveLine((i) => (i + 1) % book.excerpt.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [playing, settings.speed, book.excerpt.length]);

  // Keep highlighted line in view
  useEffect(() => {
    const el = lineRefs.current[activeLine];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLine]);

  const progress = (activeLine + 1) / book.excerpt.length;
  const minutesIn = Math.round(progress * 22);
  const minutesLeft = 22 - minutesIn;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
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

      {/* Reading area */}
      <main className="flex-1 px-6 pb-48 pt-10 sm:px-8 sm:pt-16">
        <article
          className="mx-auto max-w-[60ch] space-y-7 font-serif"
          style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
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
                  settings.highlight === "soft" && "reading-line",
                  settings.highlight === "underline" &&
                    (active
                      ? "underline decoration-accent decoration-2 underline-offset-[6px]"
                      : "text-foreground/45"),
                  settings.highlight === "bar" &&
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
      </main>

      {/* Floating bottom player */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="pointer-events-auto mx-auto max-w-lg rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:p-5">
          {/* Scrubber */}
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

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  speed: s.speed >= 1.75 ? 0.8 : Math.round((s.speed + 0.25) * 100) / 100,
                }))
              }
              className="min-w-12 rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground hover:text-foreground"
              aria-label="Reading speed"
            >
              {settings.speed}x
            </button>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setActiveLine((i) => Math.max(0, i - 1))}
                className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Previous line"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform hover:scale-[1.03] active:scale-95"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <Pause className="size-6" />
                ) : (
                  <Play className="ml-0.5 size-6" />
                )}
              </button>
              <button
                onClick={() =>
                  setActiveLine((i) => Math.min(book.excerpt.length - 1, i + 1))
                }
                className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Next line"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setSettings((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }))
                }
                className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Toggle theme"
              >
                {settings.theme === "dark" ? (
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
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}
