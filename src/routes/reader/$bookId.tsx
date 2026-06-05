import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibrary } from "@/components/library-provider";
import { SettingsSheet } from "@/components/settings-sheet";
import { loadBookAsset } from "@/lib/book-assets";
import { type BookNote, type Bookmark as BookmarkType } from "@/lib/books";
import { createEpubTextReader, type EpubTextReader, type EpubTextSection } from "@/lib/epub-text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reader/$bookId")({
  head: () => ({
    meta: [{ title: "Reader - ReadAlong" }, { name: "description", content: "ReadAlong reader" }],
  }),
  component: ReaderPage,
});

function ReaderPage() {
  const { bookId } = Route.useParams();
  const {
    books,
    bookmarks,
    notes,
    readerSettings,
    setCurrentBookId,
    setReaderSettings,
    toggleBookmark,
    saveNote,
    deleteNote,
    updateBook,
  } = useLibrary();

  const [playing, setPlaying] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
  const [bookDataLoading, setBookDataLoading] = useState(false);
  const [bookDataError, setBookDataError] = useState<string | null>(null);
  const [localSection, setLocalSection] = useState<EpubTextSection | null>(null);
  const [localSectionLoading, setLocalSectionLoading] = useState(false);
  const [localSectionError, setLocalSectionError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const localReaderRef = useRef<EpubTextReader | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const localSpeechRestartKeyRef = useRef<string | null>(null);
  const demoSpeechRestartKeyRef = useRef<string | null>(null);
  const suppressDemoAdvanceRef = useRef(false);

  const book = books.find((entry) => entry.id === bookId) ?? null;
  const isLocalBook = book?.source.kind === "local";
  const localAssetId = isLocalBook ? (book?.source.assetId ?? null) : null;
  const activeLine = book?.activeLine ?? 0;
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const currentText = isLocalBook
    ? (localSection?.paragraphs[activeLine] ?? "")
    : (book?.excerpt[activeLine] ?? "");
  const currentSectionHref = isLocalBook ? localSection?.href : undefined;

  const currentBookmark = useMemo(
    () =>
      book
        ? (bookmarks.find(
            (entry) =>
              entry.bookId === book.id &&
              entry.sectionHref === currentSectionHref &&
              entry.paragraphIndex === activeLine,
          ) ?? null)
        : null,
    [activeLine, book, bookmarks, currentSectionHref],
  );

  const currentNote = useMemo(
    () =>
      book
        ? (notes.find(
            (entry) =>
              entry.bookId === book.id &&
              entry.sectionHref === currentSectionHref &&
              entry.paragraphIndex === activeLine,
          ) ?? null)
        : null,
    [activeLine, book, currentSectionHref, notes],
  );

  const bookNotes = useMemo(
    () => (book ? notes.filter((entry) => entry.bookId === book.id) : []),
    [book, notes],
  );

  const progress = book
    ? isLocalBook
      ? book.progress
      : (activeLine + 1) / Math.max(book.excerpt.length, 1)
    : 0;
  const progressPercent = Math.round(progress * 100);
  const localReaderReady =
    !!localSection &&
    !bookDataLoading &&
    !bookDataError &&
    !localSectionLoading &&
    !localSectionError;

  const getSelectedVoice = useCallback(() => {
    if (!speechSupported) return null;

    return (
      window.speechSynthesis
        .getVoices()
        .find(
          (voice) =>
            voice.name === readerSettings.voice || readerSettings.voice === "Default voice",
        ) ?? null
    );
  }, [readerSettings.voice, speechSupported]);

  const setActiveLine = useCallback(
    (nextLineOrUpdater: number | ((line: number) => number)) => {
      if (!book) return;

      const maxLine = isLocalBook
        ? Math.max((localSection?.paragraphs.length ?? 1) - 1, 0)
        : Math.max(book.excerpt.length - 1, 0);

      updateBook(book.id, (currentBook) => {
        const nextLine =
          typeof nextLineOrUpdater === "function"
            ? nextLineOrUpdater(currentBook.activeLine)
            : nextLineOrUpdater;

        return {
          ...currentBook,
          activeLine: Math.max(0, Math.min(maxLine, nextLine)),
        };
      });
    },
    [book, isLocalBook, localSection?.paragraphs.length, updateBook],
  );

  const stopSpeech = useCallback(
    (nextPlaying = false) => {
      if (!speechSupported) return;

      suppressDemoAdvanceRef.current = true;
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      localSpeechRestartKeyRef.current = null;
      demoSpeechRestartKeyRef.current = null;
      setPlaying(nextPlaying);
    },
    [speechSupported],
  );

  const loadLocalSection = useCallback(
    async (target?: string) => {
      if (!book || !isLocalBook || !localReaderRef.current) return;

      setLocalSectionLoading(true);
      setLocalSectionError(null);

      try {
        const section = await localReaderRef.current.loadSection(target);
        setLocalSection(section);
        updateBook(book.id, (currentBook) => ({
          ...currentBook,
          chapter: section.chapter,
          locationHref: section.href,
          progress: section.progress,
          activeLine: 0,
        }));
      } catch (error) {
        console.error("Failed to change EPUB section", error);
        setLocalSectionError(
          error instanceof Error ? error.message : "Unable to open this part of the book.",
        );
      } finally {
        setLocalSectionLoading(false);
      }
    },
    [book, isLocalBook, updateBook],
  );

  const startLocalSpeech = useCallback(() => {
    if (!speechSupported || !book || !localSection) return;

    const text = localSection.paragraphs[activeLine]?.trim() ?? "";
    if (!text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = readerSettings.speed;

    const selectedVoice = getSelectedVoice();
    if (selectedVoice && readerSettings.voice !== "Default voice") {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      utteranceRef.current = null;
      localSpeechRestartKeyRef.current = null;

      if (activeLine < localSection.paragraphs.length - 1) {
        setActiveLine((line) => line + 1);
        return;
      }

      if (localSection.nextHref) {
        void loadLocalSection(localSection.nextHref);
        return;
      }

      setPlaying(false);
    };

    utterance.onerror = () => {
      utteranceRef.current = null;
      localSpeechRestartKeyRef.current = null;
      setPlaying(false);
    };

    utteranceRef.current = utterance;
    localSpeechRestartKeyRef.current = `${book.id}:${localSection.href}:${activeLine}:${readerSettings.speed}:${readerSettings.voice}`;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }, [
    activeLine,
    book,
    getSelectedVoice,
    loadLocalSection,
    localSection,
    readerSettings.speed,
    readerSettings.voice,
    setActiveLine,
    speechSupported,
  ]);

  const startDemoSpeech = useCallback(() => {
    if (!speechSupported || !book || isLocalBook) return;

    const text = book.excerpt[activeLine]?.trim() ?? "";
    if (!text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = readerSettings.speed;

    const selectedVoice = getSelectedVoice();
    if (selectedVoice && readerSettings.voice !== "Default voice") {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      utteranceRef.current = null;
      demoSpeechRestartKeyRef.current = null;

      if (suppressDemoAdvanceRef.current) {
        suppressDemoAdvanceRef.current = false;
        return;
      }

      setActiveLine((line) => (line + 1) % Math.max(book.excerpt.length, 1));
    };

    utterance.onerror = () => {
      utteranceRef.current = null;
      demoSpeechRestartKeyRef.current = null;
      suppressDemoAdvanceRef.current = false;
      setPlaying(false);
    };

    suppressDemoAdvanceRef.current = false;
    utteranceRef.current = utterance;
    demoSpeechRestartKeyRef.current = `${book.id}:${activeLine}:${readerSettings.speed}:${readerSettings.voice}`;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }, [
    activeLine,
    book,
    getSelectedVoice,
    isLocalBook,
    readerSettings.speed,
    readerSettings.voice,
    setActiveLine,
    speechSupported,
  ]);

  const handleToggleBookmark = useCallback(() => {
    if (!book || !currentText.trim()) return;

    toggleBookmark({
      bookId: book.id,
      sectionHref: currentSectionHref,
      paragraphIndex: activeLine,
      text: currentText,
    });
  }, [activeLine, book, currentSectionHref, currentText, toggleBookmark]);

  const openNoteEditor = useCallback(() => {
    setNoteDraft(currentNote?.content ?? "");
    setNoteEditorOpen(true);
  }, [currentNote]);

  const handleSaveNote = useCallback(() => {
    if (!book || !currentText.trim()) return;

    const trimmed = noteDraft.trim();
    if (!trimmed) {
      if (currentNote) {
        deleteNote(currentNote.id);
      }
      setNoteEditorOpen(false);
      return;
    }

    saveNote({
      bookId: book.id,
      sectionHref: currentSectionHref,
      paragraphIndex: activeLine,
      anchorText: currentText,
      content: trimmed,
    });
    setNoteEditorOpen(false);
  }, [
    activeLine,
    book,
    currentNote,
    currentSectionHref,
    currentText,
    deleteNote,
    noteDraft,
    saveNote,
  ]);

  useEffect(() => {
    if (!book) return;
    setCurrentBookId(book.id);
  }, [book, setCurrentBookId]);

  useEffect(() => {
    if (!book) return;
    setPlaying(!isLocalBook);
  }, [book, isLocalBook]);

  useEffect(() => {
    const root = document.documentElement;
    if (readerSettings.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    return () => root.classList.remove("dark");
  }, [readerSettings.theme]);

  useEffect(() => {
    if (!speechSupported) return;

    const readVoices = () => {
      const voices = window.speechSynthesis.getVoices().map((voice) => voice.name);
      setAvailableVoices(voices.length > 0 ? voices : ["Default voice"]);
    };

    readVoices();
    window.speechSynthesis.addEventListener("voiceschanged", readVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", readVoices);
  }, [speechSupported]);

  useEffect(() => {
    let cancelled = false;

    const loadSource = async () => {
      if (!localAssetId) {
        setBookData(null);
        setBookDataLoading(false);
        setBookDataError(null);
        return;
      }

      setBookDataLoading(true);
      setBookDataError(null);

      try {
        const asset = await loadBookAsset(localAssetId);
        if (!asset || cancelled) {
          if (!cancelled) {
            setBookData(null);
            setBookDataError(
              "We couldn't find the EPUB data for this book. Please import it again.",
            );
          }
          return;
        }

        const buffer = await asset.arrayBuffer();
        if (!cancelled) {
          setBookData(buffer);
        }
      } catch (error) {
        console.error("Failed to load EPUB asset", error);
        if (!cancelled) {
          setBookData(null);
          setBookDataError(
            error instanceof Error ? error.message : "Unable to load the EPUB file.",
          );
        }
      } finally {
        if (!cancelled) {
          setBookDataLoading(false);
        }
      }
    };

    void loadSource();

    return () => {
      cancelled = true;
    };
  }, [localAssetId]);

  useEffect(() => {
    let cancelled = false;
    let reader: EpubTextReader | null = null;

    const loadInitialSection = async () => {
      if (!isLocalBook || !bookData || !book) {
        setLocalSection(null);
        setLocalSectionLoading(false);
        setLocalSectionError(null);
        return;
      }

      setLocalSectionLoading(true);
      setLocalSectionError(null);

      try {
        reader = await createEpubTextReader(bookData, {
          title: book.title,
          author: book.author,
        });
        if (cancelled) {
          reader.destroy();
          return;
        }

        localReaderRef.current = reader;
        const section = await reader.loadSection(book.locationHref ?? book.locationCfi);
        if (cancelled) {
          reader.destroy();
          return;
        }

        setLocalSection(section);
        updateBook(book.id, (currentBook) => ({
          ...currentBook,
          chapter: section.chapter,
          locationHref: section.href,
          progress: section.progress,
          activeLine: Math.min(currentBook.activeLine, Math.max(section.paragraphs.length - 1, 0)),
        }));
      } catch (error) {
        console.error("Failed to prepare EPUB text view", error);
        if (!cancelled) {
          setLocalSection(null);
          setLocalSectionError(
            error instanceof Error
              ? error.message
              : "Unable to extract readable text from this EPUB.",
          );
        }
      } finally {
        if (!cancelled) {
          setLocalSectionLoading(false);
        }
      }
    };

    void loadInitialSection();

    return () => {
      cancelled = true;
      localReaderRef.current = null;
      reader?.destroy();
    };
  }, [book?.id, bookData, isLocalBook, updateBook, book]);

  useEffect(() => {
    const el = lineRefs.current[activeLine];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLine, currentSectionHref]);

  useEffect(() => {
    if (!speechSupported) return;

    return () => {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, [speechSupported]);

  useEffect(() => {
    if (!isLocalBook || !playing || !book) return;
    if (!localSection?.paragraphs.length) return;

    const nextKey = `${book.id}:${localSection.href}:${activeLine}:${readerSettings.speed}:${readerSettings.voice}`;
    if (localSpeechRestartKeyRef.current === nextKey) return;

    startLocalSpeech();
  }, [
    activeLine,
    book,
    isLocalBook,
    localSection,
    playing,
    readerSettings.speed,
    readerSettings.voice,
    startLocalSpeech,
  ]);

  useEffect(() => {
    if (isLocalBook || !playing || !book) return;

    const nextKey = `${book.id}:${activeLine}:${readerSettings.speed}:${readerSettings.voice}`;
    if (demoSpeechRestartKeyRef.current === nextKey) return;

    startDemoSpeech();
  }, [
    activeLine,
    book,
    isLocalBook,
    playing,
    readerSettings.speed,
    readerSettings.voice,
    startDemoSpeech,
  ]);

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
            onClick={handleToggleBookmark}
            className={cn(
              "grid size-9 place-items-center rounded-full hover:bg-muted",
              currentBookmark ? "text-accent" : "text-muted-foreground",
            )}
            aria-label={currentBookmark ? "Remove bookmark" : "Add bookmark"}
          >
            <Bookmark className="size-5" fill={currentBookmark ? "currentColor" : "none"} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-52 pt-10 sm:px-8 sm:pt-16">
        {isLocalBook ? (
          bookDataLoading || localSectionLoading ? (
            <div className="mx-auto grid min-h-[28rem] max-w-5xl place-items-center rounded-[2rem] border border-border bg-card">
              <div className="flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
                <LoaderCircle className="size-4 animate-spin" />
                Preparing your book
              </div>
            </div>
          ) : bookDataError || localSectionError ? (
            <div className="mx-auto grid min-h-[28rem] max-w-5xl place-items-center rounded-[2rem] border border-border bg-card p-6 text-center">
              <div>
                <p className="font-medium text-foreground">This EPUB could not be opened.</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {bookDataError ?? localSectionError}
                </p>
              </div>
            </div>
          ) : localSection ? (
            <article
              className="mx-auto max-w-[60ch] space-y-7 font-serif"
              style={{ fontSize: readerSettings.fontSize, lineHeight: readerSettings.lineHeight }}
            >
              {localSection.paragraphs.map((line, index) => {
                const active = index === activeLine;
                return (
                  <p
                    key={`${localSection.href}-${index}`}
                    ref={(el) => {
                      lineRefs.current[index] = el;
                    }}
                    onClick={() => setActiveLine(index)}
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
          ) : (
            <div className="mx-auto grid min-h-[28rem] max-w-5xl place-items-center rounded-[2rem] border border-border bg-card p-6 text-center">
              <div>
                <p className="font-medium text-foreground">This EPUB is not ready yet.</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  We could not attach the uploaded file to the reader. Please import the EPUB again.
                </p>
              </div>
            </div>
          )
        ) : (
          <article
            className="mx-auto max-w-[60ch] space-y-7 font-serif"
            style={{ fontSize: readerSettings.fontSize, lineHeight: readerSettings.lineHeight }}
          >
            {book.excerpt.map((line, index) => {
              const active = index === activeLine;
              return (
                <p
                  key={index}
                  ref={(el) => {
                    lineRefs.current[index] = el;
                  }}
                  onClick={() => setActiveLine(index)}
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

        {bookNotes.length > 0 ? (
          <section className="mx-auto mt-12 max-w-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Notes
              </h2>
            </div>
            <div className="space-y-3">
              {bookNotes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">{note.anchorText}</p>
                  <p className="mt-2 text-sm leading-6">{note.content}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(note.updatedAt).toLocaleString()}</span>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="rounded-full px-2 py-1 hover:bg-muted hover:text-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
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
              disabled={isLocalBook && (!speechSupported || !localReaderReady)}
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
                isLocalBook && (!speechSupported || !localReaderReady)
                  ? "cursor-not-allowed opacity-40"
                  : "hover:text-foreground",
              )}
              aria-label={
                isLocalBook && !localReaderReady
                  ? "EPUB playback will be available once the book finishes loading"
                  : isLocalBook && !speechSupported
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
                    if (!localReaderReady) return;
                    if (playing) {
                      stopSpeech(true);
                    }
                    if (localSection?.prevHref) {
                      void loadLocalSection(localSection.prevHref);
                    }
                    return;
                  }

                  if (playing) {
                    stopSpeech(true);
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
                    if (!localReaderReady) return;
                    if (playing) {
                      stopSpeech();
                    } else {
                      startLocalSpeech();
                    }
                    return;
                  }

                  if (playing) {
                    stopSpeech();
                  } else {
                    setPlaying(true);
                  }
                }}
                className={cn(
                  "grid size-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform",
                  isLocalBook && (!speechSupported || !localReaderReady)
                    ? "cursor-not-allowed opacity-60"
                    : "hover:scale-[1.03] active:scale-95",
                )}
                aria-label={
                  isLocalBook && !localReaderReady
                    ? "EPUB playback will be available once the book finishes loading"
                    : isLocalBook && !speechSupported
                      ? "Speech synthesis is not available in this browser"
                      : playing
                        ? "Pause"
                        : "Play"
                }
                disabled={isLocalBook && (!speechSupported || !localReaderReady)}
              >
                {playing ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
              </button>
              <button
                onClick={() => {
                  if (isLocalBook) {
                    if (!localReaderReady) return;
                    if (playing) {
                      stopSpeech(true);
                    }
                    if (localSection?.nextHref) {
                      void loadLocalSection(localSection.nextHref);
                    }
                    return;
                  }

                  if (playing) {
                    stopSpeech(true);
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
                onClick={openNoteEditor}
                className="rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Add note"
              >
                Note
              </button>
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

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
          noteEditorOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setNoteEditorOpen(false)}
        aria-hidden
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-card text-card-foreground shadow-2xl transition-transform duration-300 ease-out",
          noteEditorOpen ? "translate-y-0" : "translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Add note"
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>
        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-serif text-xl">Note</h2>
          <button
            onClick={() => setNoteEditorOpen(false)}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 pb-8 pt-4">
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            {currentText || "Select a line to attach a note."}
          </div>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            rows={6}
            placeholder="Write a note for this line"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-accent"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (currentNote) {
                  deleteNote(currentNote.id);
                }
                setNoteDraft("");
                setNoteEditorOpen(false);
              }}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {currentNote ? "Delete note" : "Cancel"}
            </button>
            <button
              onClick={handleSaveNote}
              className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground"
            >
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
