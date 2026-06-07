import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListTree,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  Settings2,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReaderMapDrawer } from "@/components/reader/reader-map-drawer";
import { ReaderNoteEditorSheet } from "@/components/reader/reader-note-editor-sheet";
import { ReaderPage } from "@/components/reader/reader-page";
import { useLibrary } from "@/components/library-provider";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";
import { SettingsSheet } from "@/components/settings-sheet";
import { useReaderSpeech } from "@/hooks/use-reader-speech";
import { loadBookAsset } from "@/lib/book-assets";
import { type BookNote, type Bookmark as BookmarkType } from "@/lib/books";
import {
  createEpubTextReader,
  type EpubReadingMapItem,
  type EpubTextReader,
  type EpubTextSection,
} from "@/lib/epub-text";
import { getBookProgress, paginateSection, resolvePagePosition } from "@/lib/reader-pagination";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reader/$bookId")({
  head: () => ({
    meta: [{ title: "Reader - ReadAlong" }, { name: "description", content: "ReadAlong reader" }],
  }),
  component: ReaderPageRoute,
});

interface LocalResumeSnapshot {
  locationHref?: string;
  locationCfi?: string;
  pageIndex?: number;
  activeLine: number;
}

function ReaderPageRoute() {
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

  const [playing, setPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingMapOpen, setReadingMapOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
  const [bookDataLoading, setBookDataLoading] = useState(false);
  const [bookDataError, setBookDataError] = useState<string | null>(null);
  const [localSection, setLocalSection] = useState<EpubTextSection | null>(null);
  const [localSectionLoading, setLocalSectionLoading] = useState(false);
  const [localSectionError, setLocalSectionError] = useState<string | null>(null);
  const [readingMap, setReadingMap] = useState<EpubReadingMapItem[]>([]);

  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const localReaderRef = useRef<EpubTextReader | null>(null);
  const sectionRequestRef = useRef(0);
  const initialLocalResumeRef = useRef<LocalResumeSnapshot | null>(null);

  const book = books.find((entry) => entry.id === bookId) ?? null;
  const currentBookId = book?.id ?? null;
  const isLocalBook = book?.source.kind === "local";
  const localBookId = isLocalBook ? (book?.id ?? null) : null;
  const localBookTitle = isLocalBook ? (book?.title ?? "") : "";
  const localBookAuthor = isLocalBook ? (book?.author ?? "") : "";
  const localAssetId = isLocalBook ? (book?.source.assetId ?? null) : null;
  const storedActiveLine = book?.activeLine ?? 0;
  const savedLocationHref = book?.locationHref;
  const savedLocationCfi = book?.locationCfi;
  const savedPageIndex = book?.pageIndex;

  useEffect(() => {
    if (!currentBookId || !isLocalBook) {
      initialLocalResumeRef.current = null;
      return;
    }

    initialLocalResumeRef.current = {
      locationHref: savedLocationHref,
      locationCfi: savedLocationCfi,
      pageIndex: savedPageIndex,
      activeLine: storedActiveLine,
    };
  }, [
    currentBookId,
    isLocalBook,
    savedLocationCfi,
    savedLocationHref,
    savedPageIndex,
    storedActiveLine,
  ]);

  const localPages = useMemo(
    () => (localSection ? paginateSection(localSection, readerSettings.textUnit) : []),
    [localSection, readerSettings.textUnit],
  );
  const resolvedLocalPosition = useMemo(
    () =>
      resolvePagePosition(localPages, {
        pageIndex: book?.pageIndex,
        activeLine: storedActiveLine,
      }),
    [book?.pageIndex, localPages, storedActiveLine],
  );
  const currentPage = isLocalBook ? (localPages[resolvedLocalPosition.pageIndex] ?? null) : null;
  const activeLine = isLocalBook ? resolvedLocalPosition.activeLine : storedActiveLine;
  const currentParagraphIndex =
    isLocalBook && currentPage ? (currentPage.units[activeLine]?.paragraphIndex ?? 0) : activeLine;
  const currentText = isLocalBook
    ? (currentPage?.units[activeLine]?.text ?? "")
    : (book?.excerpt[activeLine] ?? "");
  const currentSectionHref = isLocalBook ? localSection?.href : undefined;
  const currentPageIndex = isLocalBook ? resolvedLocalPosition.pageIndex : 0;

  const currentBookmark = useMemo(
    () =>
      book
        ? (bookmarks.find(
            (entry) =>
              entry.bookId === book.id &&
              entry.sectionHref === currentSectionHref &&
              entry.paragraphIndex === currentParagraphIndex,
          ) ?? null)
        : null,
    [book, bookmarks, currentParagraphIndex, currentSectionHref],
  );

  const currentNote = useMemo(
    () =>
      book
        ? (notes.find(
            (entry) =>
              entry.bookId === book.id &&
              entry.sectionHref === currentSectionHref &&
              entry.paragraphIndex === currentParagraphIndex,
          ) ?? null)
        : null,
    [book, currentParagraphIndex, currentSectionHref, notes],
  );

  const bookBookmarks = useMemo(
    () => (book ? bookmarks.filter((entry) => entry.bookId === book.id) : []),
    [book, bookmarks],
  );
  const bookNotes = useMemo(
    () => (book ? notes.filter((entry) => entry.bookId === book.id) : []),
    [book, notes],
  );
  const lastBookmark = bookBookmarks[0] ?? null;
  const lastNote = bookNotes[0] ?? null;
  const progress = book
    ? isLocalBook && localSection && currentPage
      ? getBookProgress(localSection, currentPage)
      : (activeLine + 1) / Math.max(book.excerpt.length, 1)
    : 0;
  const progressPercent = Math.round(progress * 100);
  const chapterMap = useMemo<EpubReadingMapItem[]>(
    () =>
      isLocalBook
        ? readingMap
        : book
          ? [{ href: book.id, label: book.chapter, index: 0, progress }]
          : [],
    [book, isLocalBook, progress, readingMap],
  );
  const localReaderReady =
    !!currentPage &&
    !bookDataLoading &&
    !bookDataError &&
    !localSectionLoading &&
    !localSectionError &&
    !!localSection;
  const shouldKeepScreenAwake = playing && (!isLocalBook || localReaderReady);

  useScreenWakeLock(shouldKeepScreenAwake);

  const persistLocalPosition = useCallback(
    (
      section: EpubTextSection,
      pages: ReturnType<typeof paginateSection>,
      pageIndex: number,
      lineIndex: number,
    ) => {
      if (!book) return;

      const page = pages[pageIndex];
      if (!page) return;

      const nextProgress = getBookProgress(section, page);

      updateBook(book.id, (currentBook) => {
        if (
          currentBook.chapter === section.chapter &&
          currentBook.locationHref === section.href &&
          currentBook.pageIndex === page.pageIndex &&
          currentBook.progress === nextProgress &&
          currentBook.activeLine === lineIndex
        ) {
          return currentBook;
        }

        return {
          ...currentBook,
          chapter: section.chapter,
          locationHref: section.href,
          pageIndex: page.pageIndex,
          progress: nextProgress,
          activeLine: lineIndex,
        };
      });
    },
    [book, updateBook],
  );

  const setLocalCursor = useCallback(
    (pageIndex: number, lineIndex = 0) => {
      if (!localSection || !book) return;
      const resolved = resolvePagePosition(localPages, { pageIndex, activeLine: lineIndex });
      persistLocalPosition(localSection, localPages, resolved.pageIndex, resolved.activeLine);
    },
    [book, localPages, localSection, persistLocalPosition],
  );

  const loadLocalSection = useCallback(
    async (
      target?: string,
      options?: {
        pageIndex?: number;
        paragraphIndex?: number;
        activeLine?: number;
      },
    ) => {
      if (!book || !isLocalBook || !localReaderRef.current) return;

      const requestId = ++sectionRequestRef.current;
      setLocalSectionLoading(true);
      setLocalSectionError(null);

      try {
        const section = await localReaderRef.current.loadSection(target);
        if (sectionRequestRef.current !== requestId) {
          return;
        }

        const pages = paginateSection(section, readerSettings.textUnit);
        const resolved = resolvePagePosition(pages, options);
        setLocalSection(section);
        persistLocalPosition(section, pages, resolved.pageIndex, resolved.activeLine);
      } catch (error) {
        console.error("Failed to change EPUB section", error);
        if (sectionRequestRef.current === requestId) {
          setLocalSectionError(
            error instanceof Error ? error.message : "Unable to open this part of the book.",
          );
        }
      } finally {
        if (sectionRequestRef.current === requestId) {
          setLocalSectionLoading(false);
        }
      }
    },
    [book, isLocalBook, persistLocalPosition, readerSettings.textUnit],
  );

  const setActiveLine = useCallback(
    (nextLineOrUpdater: number | ((line: number) => number)) => {
      if (!book) return;

      if (isLocalBook) {
        const maxLine = Math.max((currentPage?.units.length ?? 1) - 1, 0);
        const nextLine =
          typeof nextLineOrUpdater === "function"
            ? nextLineOrUpdater(activeLine)
            : nextLineOrUpdater;
        setLocalCursor(currentPageIndex, Math.max(0, Math.min(maxLine, nextLine)));
        return;
      }

      const maxLine = Math.max(book.excerpt.length - 1, 0);
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
    [
      activeLine,
      book,
      currentPage?.units.length,
      currentPageIndex,
      isLocalBook,
      setLocalCursor,
      updateBook,
    ],
  );

  const handlePlaybackComplete = useCallback(() => {
    if (!book) return;

    if (!isLocalBook) {
      setActiveLine((line) => (line + 1) % Math.max(book.excerpt.length, 1));
      return;
    }

    if (!currentPage || !localSection) {
      setPlaying(false);
      return;
    }

    if (activeLine < currentPage.units.length - 1) {
      setActiveLine(activeLine + 1);
      return;
    }

    if (currentPageIndex < currentPage.pageCount - 1) {
      setLocalCursor(currentPageIndex + 1, 0);
      return;
    }

    if (localSection.nextHref) {
      void loadLocalSection(localSection.nextHref, { pageIndex: 0, activeLine: 0 });
      return;
    }

    setPlaying(false);
  }, [
    activeLine,
    book,
    currentPage,
    currentPageIndex,
    isLocalBook,
    loadLocalSection,
    localSection,
    setActiveLine,
    setLocalCursor,
  ]);

  const {
    supported: speechSupported,
    availableVoices,
    speak,
    stop: stopSpeech,
  } = useReaderSpeech({
    enabled: !isLocalBook || localReaderReady,
    playing,
    speechKey: book
      ? isLocalBook
        ? `${book.id}:${currentSectionHref}:${currentPageIndex}:${activeLine}:${readerSettings.speed}:${readerSettings.voice}`
        : `${book.id}:${activeLine}:${readerSettings.speed}:${readerSettings.voice}`
      : null,
    text: currentText,
    voiceName: readerSettings.voice,
    rate: readerSettings.speed,
    onEnd: handlePlaybackComplete,
    onError: () => setPlaying(false),
    setPlaying,
  });

  const handleToggleBookmark = useCallback(() => {
    if (!book || !currentText.trim()) return;

    toggleBookmark({
      bookId: book.id,
      sectionHref: currentSectionHref,
      pageIndex: isLocalBook ? currentPageIndex : undefined,
      paragraphIndex: currentParagraphIndex,
      text: currentText,
    });
  }, [
    book,
    currentPageIndex,
    currentParagraphIndex,
    currentSectionHref,
    currentText,
    isLocalBook,
    toggleBookmark,
  ]);

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
      pageIndex: isLocalBook ? currentPageIndex : undefined,
      paragraphIndex: currentParagraphIndex,
      anchorText: currentText,
      content: trimmed,
    });
    setNoteEditorOpen(false);
  }, [
    book,
    currentNote,
    currentPageIndex,
    currentParagraphIndex,
    currentSectionHref,
    currentText,
    deleteNote,
    isLocalBook,
    noteDraft,
    saveNote,
  ]);

  const jumpToLocalAnchor = useCallback(
    async ({
      sectionHref,
      pageIndex,
      paragraphIndex,
    }: {
      sectionHref?: string;
      pageIndex?: number;
      paragraphIndex: number;
    }) => {
      if (!localReaderReady || !localSection) return;

      stopSpeech(true);

      if (sectionHref && sectionHref !== localSection.href) {
        await loadLocalSection(sectionHref, { pageIndex, paragraphIndex });
        return;
      }

      const resolved = resolvePagePosition(localPages, { pageIndex, paragraphIndex });
      setLocalCursor(resolved.pageIndex, resolved.activeLine);
    },
    [localPages, localReaderReady, localSection, loadLocalSection, setLocalCursor, stopSpeech],
  );

  const handleJumpToChapter = useCallback(
    (chapter: EpubReadingMapItem) => {
      if (isLocalBook) {
        stopSpeech(true);
        void loadLocalSection(chapter.href, { pageIndex: 0, activeLine: 0 });
        return;
      }

      stopSpeech(true);
      setActiveLine(0);
    },
    [isLocalBook, loadLocalSection, setActiveLine, stopSpeech],
  );

  useEffect(() => {
    if (!book) return;
    setCurrentBookId(book.id);
  }, [book, setCurrentBookId]);

  useEffect(() => {
    if (!currentBookId) return;
    setPlaying(false);
  }, [currentBookId]);

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
    let cancelled = false;

    const loadSource = async () => {
      if (!localAssetId) {
        setBookData(null);
        setBookDataLoading(false);
        setBookDataError(null);
        setReadingMap([]);
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
      if (!isLocalBook || !bookData || !localBookId) {
        setLocalSection(null);
        setLocalSectionLoading(false);
        setLocalSectionError(null);
        setReadingMap([]);
        return;
      }

      setLocalSectionLoading(true);
      setLocalSectionError(null);

      try {
        reader = await createEpubTextReader(bookData, {
          title: localBookTitle,
          author: localBookAuthor,
        });
        if (cancelled) {
          reader.destroy();
          return;
        }

        localReaderRef.current = reader;
        setReadingMap(reader.getReadingMap());
        const resume = initialLocalResumeRef.current;
        const section = await reader.loadSection(resume?.locationHref ?? resume?.locationCfi);
        if (cancelled) {
          reader.destroy();
          return;
        }

        const pages = paginateSection(section, readerSettings.textUnit);
        const useSavedPage = resume?.locationHref && resume.locationHref === section.href;
        const resolved = resolvePagePosition(pages, {
          pageIndex: useSavedPage ? resume?.pageIndex : 0,
          activeLine: useSavedPage ? resume?.activeLine : 0,
        });

        setLocalSection(section);
        persistLocalPosition(section, pages, resolved.pageIndex, resolved.activeLine);
      } catch (error) {
        console.error("Failed to prepare EPUB text view", error);
        if (!cancelled) {
          setLocalSection(null);
          setReadingMap([]);
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
  }, [
    bookData,
    isLocalBook,
    localBookAuthor,
    localBookId,
    localBookTitle,
    persistLocalPosition,
    readerSettings.textUnit,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const element = lineRefs.current[activeLine];
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeLine, currentPage?.id, currentSectionHref]);

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

  const showLocalLoadingCard =
    isLocalBook && !localSection && (bookDataLoading || localSectionLoading);
  const showLocalErrorCard = isLocalBook && !localSection && (bookDataError || localSectionError);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-5">
          <Link
            to="/library"
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Back to library"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {book.chapter}
            </p>
            <p className="truncate font-serif text-sm italic">{book.title}</p>
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

      <main className="flex-1 px-4 pb-60 pt-8 sm:px-8 sm:pb-52 sm:pt-16">
        {showLocalLoadingCard ? (
          <div className="mx-auto grid min-h-[28rem] max-w-5xl place-items-center rounded-[2rem] border border-border bg-card">
            <div className="flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Preparing your book
            </div>
          </div>
        ) : showLocalErrorCard ? (
          <div className="mx-auto grid min-h-[28rem] max-w-5xl place-items-center rounded-[2rem] border border-border bg-card p-6 text-center">
            <div>
              <p className="font-medium text-foreground">This EPUB could not be opened.</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {bookDataError ?? localSectionError}
              </p>
            </div>
          </div>
        ) : isLocalBook ? (
          <>
            {currentPage ? (
              <ReaderPage
                pageKey={currentPage.id}
                paragraphs={currentPage.units.map((unit) => unit.text)}
                activeLine={activeLine}
                fontSize={readerSettings.fontSize}
                lineHeight={readerSettings.lineHeight}
                highlight={readerSettings.highlight}
                registerLineRef={(index, element) => {
                  lineRefs.current[index] = element;
                }}
                onSelectLine={setActiveLine}
              />
            ) : (
              <div className="mx-auto grid min-h-[28rem] max-w-5xl place-items-center rounded-[2rem] border border-border bg-card p-6 text-center">
                <div>
                  <p className="font-medium text-foreground">This EPUB is not ready yet.</p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    We could not attach the uploaded file to the reader. Please import the EPUB
                    again.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <ReaderPage
            pageKey={book.id}
            paragraphs={book.excerpt}
            activeLine={activeLine}
            fontSize={readerSettings.fontSize}
            lineHeight={readerSettings.lineHeight}
            highlight={readerSettings.highlight}
            registerLineRef={(index, element) => {
              lineRefs.current[index] = element;
            }}
            onSelectLine={setActiveLine}
          />
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="pointer-events-auto mx-auto max-w-[min(42rem,calc(100vw-1rem))] rounded-3xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md sm:max-w-[min(48rem,calc(100vw-3rem))] sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {book.chapter}
            </p>
            {isLocalBook && currentPage ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Page {currentPage.pageIndex + 1} of {currentPage.pageCount}
              </span>
            ) : null}
          </div>
          <div className="mb-4 flex items-center gap-3">
            <span className="w-12 text-[10px] font-medium uppercase tracking-widest tabular-nums text-muted-foreground">
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
              {isLocalBook && currentPage
                ? `P${currentPage.pageIndex + 1}/${currentPage.pageCount}`
                : `-${22 - Math.round(progress * 22)}m`}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
            <div className="flex items-center justify-center sm:justify-start">
              <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-background/70 p-1">
                {[0.8, 1, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    disabled={isLocalBook && (!speechSupported || !localReaderReady)}
                    onClick={() => setReaderSettings({ ...readerSettings, speed })}
                    className={cn(
                      "rounded-full px-2.5 py-1.5 text-[11px] font-medium tabular-nums transition-colors sm:px-3",
                      readerSettings.speed === speed
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground",
                      isLocalBook && (!speechSupported || !localReaderReady)
                        ? "cursor-not-allowed opacity-40"
                        : "",
                    )}
                    aria-label={`Set reading speed to ${speed}x`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  if (isLocalBook) {
                    if (!localReaderReady) return;
                    stopSpeech(true);

                    if (currentPage && currentPage.pageIndex > 0) {
                      setLocalCursor(currentPage.pageIndex - 1, 0);
                      return;
                    }

                    if (localSection?.prevHref) {
                      void loadLocalSection(localSection.prevHref, {
                        pageIndex: Number.MAX_SAFE_INTEGER,
                        activeLine: 0,
                      });
                    }
                    return;
                  }

                  stopSpeech(true);
                  setActiveLine((line) => line - 1);
                }}
                className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:size-11"
                aria-label={isLocalBook ? "Previous page" : "Previous line"}
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
                      speak();
                    }
                    return;
                  }

                  if (playing) {
                    stopSpeech();
                  } else {
                    speak();
                  }
                }}
                className={cn(
                  "grid size-12 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform sm:size-14",
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
                    stopSpeech(true);

                    if (currentPage && currentPage.pageIndex < currentPage.pageCount - 1) {
                      setLocalCursor(currentPage.pageIndex + 1, 0);
                      return;
                    }

                    if (localSection?.nextHref) {
                      void loadLocalSection(localSection.nextHref, { pageIndex: 0, activeLine: 0 });
                    }
                    return;
                  }

                  stopSpeech(true);
                  setActiveLine((line) => line + 1);
                }}
                className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:size-11"
                aria-label={isLocalBook ? "Next page" : "Next line"}
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-0.5 sm:justify-end sm:gap-1">
              <button
                onClick={() => setReadingMapOpen(true)}
                className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Open reading map"
              >
                <ListTree className="size-4" />
              </button>
              <button
                onClick={openNoteEditor}
                className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:w-auto sm:px-2 sm:py-2 lg:px-3"
                aria-label="Add note"
              >
                <FileText className="size-4" />
                <span className="hidden lg:inline">Note</span>
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

      <ReaderMapDrawer
        open={readingMapOpen}
        onOpenChange={setReadingMapOpen}
        chapters={chapterMap}
        bookmarks={bookBookmarks}
        notes={bookNotes}
        lastBookmark={lastBookmark}
        lastNote={lastNote}
        activeSectionHref={currentSectionHref}
        currentProgressPercent={progressPercent}
        activeBookmarkId={currentBookmark?.id}
        activeNoteId={currentNote?.id}
        onJumpToChapter={handleJumpToChapter}
        onJumpToBookmark={(bookmark) => {
          if (isLocalBook) {
            void jumpToLocalAnchor(bookmark);
            return;
          }
          stopSpeech(true);
          setActiveLine(bookmark.paragraphIndex);
        }}
        onJumpToNote={(note) => {
          if (isLocalBook) {
            void jumpToLocalAnchor(note);
            return;
          }
          stopSpeech(true);
          setActiveLine(note.paragraphIndex);
        }}
        onDeleteNote={deleteNote}
      />

      <ReaderNoteEditorSheet
        open={noteEditorOpen}
        currentText={currentText}
        noteDraft={noteDraft}
        hasCurrentNote={!!currentNote}
        onClose={() => setNoteEditorOpen(false)}
        onDeleteOrCancel={() => {
          if (currentNote) {
            deleteNote(currentNote.id);
          }
          setNoteDraft("");
          setNoteEditorOpen(false);
        }}
        onSave={handleSaveNote}
        onDraftChange={setNoteDraft}
      />
    </div>
  );
}
