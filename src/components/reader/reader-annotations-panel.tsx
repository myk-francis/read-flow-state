import { Bookmark, MessageSquareText } from "lucide-react";
import type { BookNote, Bookmark as BookmarkType } from "@/lib/books";
import { cn } from "@/lib/utils";

interface ReaderAnnotationsPanelProps {
  bookmarks: BookmarkType[];
  notes: BookNote[];
  activeBookmarkId?: string | null;
  activeNoteId?: string | null;
  onJumpToBookmark: (bookmark: BookmarkType) => void;
  onJumpToNote: (note: BookNote) => void;
  onDeleteNote: (noteId: string) => void;
}

export function ReaderAnnotationsPanel({
  bookmarks,
  notes,
  activeBookmarkId,
  activeNoteId,
  onJumpToBookmark,
  onJumpToNote,
  onDeleteNote,
}: ReaderAnnotationsPanelProps) {
  if (bookmarks.length === 0 && notes.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mt-12 max-w-3xl space-y-8">
      {bookmarks.length > 0 ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Bookmark className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Bookmarks
            </h2>
          </div>
          <div className="space-y-3">
            {bookmarks.map((bookmark) => (
              <button
                key={bookmark.id}
                onClick={() => onJumpToBookmark(bookmark)}
                className={cn(
                  "w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40",
                  bookmark.id === activeBookmarkId && "border-accent/40 bg-accent/5",
                )}
              >
                <p className="line-clamp-3 text-sm leading-6">{bookmark.text}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Saved {new Date(bookmark.createdAt).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <MessageSquareText className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Notes
            </h2>
          </div>
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "rounded-2xl border border-border bg-card p-4",
                  note.id === activeNoteId && "border-accent/40 bg-accent/5",
                )}
              >
                <button onClick={() => onJumpToNote(note)} className="w-full text-left">
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
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
