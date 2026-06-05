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
import { EpubViewer, type EpubViewerHandle } from "@/components/epub-viewer";
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
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const viewerRef = useRef<EpubViewerHandle | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const localSpeechRestartKeyRef = useRef<string | null>(null);

  const book = books.find((entry) => entry.id === bookId) ?? null;
  const isLocalBook = book?.source.kind === "local";

  useEffect(() => {
    if (!book) return;
    if (book) {
      setCurrentBookId(book.id);
    }
  }, [book, setCurrentBookId]);

  useEffect(() => {
    if (!book) return;
    if (isLocalBook) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
  }, [book?.id, isLocalBook, book]);

  useEffect(() => {
    const root = document.documentElement;
    if (readerSettings.theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    return () => root.classList.remove("dark");
  }, [readerSettings.theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const readVoices = () => {
      const voices = window.speechSynthesis.getVoices().map((voice) => voice.name);
      setAvailableVoices(voices.length > 0 ? voices : ["Default voice"]);
    };

    readVoices();
    window.speechSynthesis.addEventListener("voiceschanged", readVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", readVoices);
  }, []);

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
    if (!book || !playing || isLocalBook) return;
    const interval = 3800 / readerSettings.speed;
    const id = window.setInterval(() => {
      setActiveLine((line) => (line + 1) % book.excerpt.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [book, isLocalBook, playing, readerSettings.speed]);

  useEffect(() => {
    if (!book || isLocalBook) return;
    const el = lineRefs.current[activeLine];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLine, book, isLocalBook]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    return () => {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, []);

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

  const progress = isLocalBook ? book.progress : (activeLine + 1) / book.excerpt.length;
  const progressPercent = Math.round(progress * 100);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stopLocalSpeech = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    localSpeechRestartKeyRef.current = null;
    setPlaying(false);
  };

  const startLocalSpeech = () => {
    if (!speechSupported) return;
    const text = viewerRef.current?.getVisibleText().trim() ?? "";
    if (!text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = readerSettings.speed;

    const selectedVoice =
      window.speechSynthesis
        .getVoices()
        .find((voice) => voice.name === readerSettings.voice || readerSettings.voice === "Default voice") ?? null;

    if (selectedVoice && readerSettings.voice !== "Default voice") {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      utteranceRef.current = null;
      localSpeechRestartKeyRef.current = null;
      setPlaying(false);
    };

    utterance.onerror = () => {
      utteranceRef.current = null;
      localSpeechRestartKeyRef.current = null;
      setPlaying(false);
    };

    utteranceRef.current = utterance;
    localSpeechRestartKeyRef.current = `${book.id}:${book.locationCfi ?? book.locationHref ?? "start"}:${readerSettings.speed}:${readerSettings.voice}`;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  };

  useEffect(() => {
    if (!isLocalBook || !playing || !book) return;
    if (!speechSupported) return;

    const nextKey = `${book.id}:${book.locationCfi ?? book.locationHref ?? "start"}:${readerSettings.speed}:${readerSettings.voice}`;
    if (localSpeechRestartKeyRef.current === nextKey) return;

    startLocalSpeech();
  }, [
    book,
    book?.id,
    book?.locationCfi,
    book?.locationHref,
    isLocalBook,
    playing,
    readerSettings.speed,
    readerSettings.voice,
    speechSupported,
  ]);

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
        {isLocalBook && bookData ? (
          <EpubViewer
            ref={viewerRef}
            source={bookData}
            className="mx-auto max-w-5xl"
            initialLocationCfi={book.locationCfi}
            initialLocationHref={book.locationHref}
            onLocationChange={(location) => {
              updateBook(book.id, (currentBook) => ({
                ...currentBook,
                locationCfi: location.cfi ?? currentBook.locationCfi,
                locationHref: location.href ?? currentBook.locationHref,
                chapter: location.chapterLabel ?? currentBook.chapter,
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
              {isLocalBook ? `${progressPercent}%` : `${Math.round(progress * 22)}m`}
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-widest text-muted-foreground",
                isLocalBook ? "w-24 truncate text-right" : "w-10 text-right tabular-nums",
              )}
              title={isLocalBook ? book.chapter : undefined}
            >
              {isLocalBook ? book.chapter : `-${22 - Math.round(progress * 22)}m`}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <button
              disabled={isLocalBook && !speechSupported}
              onClick={() =>
                setReaderSettings({
                  ...readerSettings,
                  speed:
                    readerSettings.speed >= 1.75
                      ? 0.8
                      : Math.round((readerSettings.speed + 0.25) * 100) / 100,
                })
              }
              className={cn(
                "min-w-12 rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground",
                isLocalBook && !speechSupported
                  ? "cursor-not-allowed opacity-40"
                  : "hover:text-foreground",
              )}
              aria-label={
                isLocalBook && !speechSupported
                  ? "Speech synthesis is not available in this browser"
                  : "Reading speed"
              }
            >
              {readerSettings.speed}x
            </button>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => {
                  if (isLocalBook) {
                    void viewerRef.current?.prev();
                    return;
                  }
                  setActiveLine((line) => line - 1);
                }}
                className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={isLocalBook ? "Previous section" : "Previous line"}
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                onClick={() => {
                  if (isLocalBook) {
                    if (playing) {
                      stopLocalSpeech();
                    } else {
                      startLocalSpeech();
                    }
                    return;
                  }

                  setPlaying((isPlaying) => !isPlaying);
                }}
                className={cn(
                  "grid size-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform",
                  isLocalBook && !speechSupported
                    ? "cursor-not-allowed opacity-60"
                    : "hover:scale-[1.03] active:scale-95",
                )}
                aria-label={
                  isLocalBook && !speechSupported
                    ? "Speech synthesis is not available in this browser"
                    : playing
                      ? "Pause"
                      : "Play"
                }
                disabled={isLocalBook && !speechSupported}
              >
                {playing ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
              </button>
              <button
                onClick={() => {
                  if (isLocalBook) {
                    void viewerRef.current?.next();
                    return;
                  }
                  setActiveLine((line) => line + 1);
                }}
                className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={isLocalBook ? "Next section" : "Next line"}
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
        voices={availableVoices}
      />
    </div>
  );
}
