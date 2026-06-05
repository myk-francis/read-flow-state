import { BookMarked, Bookmark, FileText, ListTree } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { BookNote, Bookmark as BookmarkType } from "@/lib/books";
import type { EpubReadingMapItem } from "@/lib/epub-text";
import { cn } from "@/lib/utils";

type ReaderDrawerTab = "chapters" | "bookmarks" | "notes";

interface ReaderMapDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: EpubReadingMapItem[];
  bookmarks: BookmarkType[];
  notes: BookNote[];
  lastBookmark?: BookmarkType | null;
  lastNote?: BookNote | null;
  activeSectionHref?: string;
  currentProgressPercent?: number;
  activeBookmarkId?: string | null;
  activeNoteId?: string | null;
  onJumpToChapter: (chapter: EpubReadingMapItem) => void;
  onJumpToBookmark: (bookmark: BookmarkType) => void;
  onJumpToNote: (note: BookNote) => void;
  onDeleteNote: (noteId: string) => void;
}

function DrawerTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function ReaderMapDrawer({
  open,
  onOpenChange,
  chapters,
  bookmarks,
  notes,
  lastBookmark,
  lastNote,
  activeSectionHref,
  currentProgressPercent,
  activeBookmarkId,
  activeNoteId,
  onJumpToChapter,
  onJumpToBookmark,
  onJumpToNote,
  onDeleteNote,
}: ReaderMapDrawerProps) {
  const [tab, setTab] = useState<ReaderDrawerTab>("chapters");

  const chapterItems = useMemo(
    () =>
      chapters.map((chapter) => ({
        ...chapter,
        title: chapter.label || `Chapter ${chapter.index + 1}`,
      })),
    [chapters],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex max-h-[85vh] flex-col rounded-t-3xl border-border bg-card text-card-foreground sm:w-[min(38rem,calc(100vw-3rem))] sm:max-h-[min(80vh,46rem)]">
        <DrawerHeader className="px-5 pb-2 pt-5 text-left">
          <DrawerTitle className="font-serif text-2xl">Reading map</DrawerTitle>
          <DrawerDescription>
            Jump by chapter, bookmark, or note without leaving your place.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 sm:pb-6">
          <div className="mb-4 rounded-2xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Current location
                </p>
                <p className="truncate text-sm font-medium">
                  {chapterItems.find((chapter) => chapter.href === activeSectionHref)?.title ??
                    "In progress"}
                </p>
              </div>
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                {currentProgressPercent ?? 0}%
              </span>
            </div>
          </div>

          {lastBookmark || lastNote ? (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {lastBookmark ? (
                <button
                  onClick={() => {
                    onJumpToBookmark(lastBookmark);
                    onOpenChange(false);
                  }}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Resume bookmark
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6">{lastBookmark.text}</p>
                </button>
              ) : null}
              {lastNote ? (
                <button
                  onClick={() => {
                    onJumpToNote(lastNote);
                    onOpenChange(false);
                  }}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Resume note
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6">{lastNote.anchorText}</p>
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mb-5 flex flex-wrap gap-2">
            <DrawerTabButton
              active={tab === "chapters"}
              icon={<ListTree className="size-4" />}
              label="Chapters"
              onClick={() => setTab("chapters")}
            />
            <DrawerTabButton
              active={tab === "bookmarks"}
              icon={<Bookmark className="size-4" />}
              label="Bookmarks"
              onClick={() => setTab("bookmarks")}
            />
            <DrawerTabButton
              active={tab === "notes"}
              icon={<FileText className="size-4" />}
              label="Notes"
              onClick={() => setTab("notes")}
            />
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-1">
            {tab === "chapters" ? (
              chapterItems.length > 0 ? (
                chapterItems.map((chapter) => (
                  <button
                    key={chapter.href}
                    onClick={() => {
                      onJumpToChapter(chapter);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/40",
                      chapter.href === activeSectionHref && "border-accent/40 bg-accent/5",
                    )}
                  >
                    <BookMarked className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{chapter.title}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.round(chapter.progress * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {Math.round(chapter.progress * 100)}%
                        </span>
                      </div>
                      {chapter.href === activeSectionHref ? (
                        <span className="mt-2 inline-flex rounded-full bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent">
                          Current
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No chapter map is available for this book yet.
                </div>
              )
            ) : null}

            {tab === "bookmarks" ? (
              bookmarks.length > 0 ? (
                bookmarks.map((bookmark) => (
                  <button
                    key={bookmark.id}
                    onClick={() => {
                      onJumpToBookmark(bookmark);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "w-full rounded-2xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/40",
                      bookmark.id === activeBookmarkId && "border-accent/40 bg-accent/5",
                    )}
                  >
                    <p className="line-clamp-3 text-sm leading-6">{bookmark.text}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Saved {new Date(bookmark.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Save a bookmark while reading and it will show up here.
                </div>
              )
            ) : null}

            {tab === "notes" ? (
              notes.length > 0 ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      "rounded-2xl border border-border bg-background px-4 py-4",
                      note.id === activeNoteId && "border-accent/40 bg-accent/5",
                    )}
                  >
                    <button
                      onClick={() => {
                        onJumpToNote(note);
                        onOpenChange(false);
                      }}
                      className="w-full text-left"
                    >
                      <p className="text-sm text-muted-foreground">{note.anchorText}</p>
                      <p className="mt-2 text-sm leading-6">{note.content}</p>
                    </button>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(note.updatedAt).toLocaleString()}</span>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="rounded-full px-2 py-1 hover:bg-muted hover:text-foreground"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Notes you save from the reader will be collected here.
                </div>
              )
            ) : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
