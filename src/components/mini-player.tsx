import { Link } from "@tanstack/react-router";
import { Pause, Play, X } from "lucide-react";
import { useState } from "react";
import { BookCover } from "./book-cover";
import type { Book } from "@/lib/books";

interface Props {
  book: Book;
  onClose?: () => void;
}

export function MiniPlayer({ book, onClose }: Props) {
  const [playing, setPlaying] = useState(true);
  const line = book.excerpt[book.activeLine] ?? "";

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-md sm:inset-x-6">
      <div className="flex items-center gap-3 p-3">
        <Link
          to="/reader/$bookId"
          params={{ bookId: book.id }}
          className="size-11 shrink-0 overflow-hidden rounded-md"
          aria-label={`Open ${book.title}`}
        >
          <BookCover book={book} size="sm" />
        </Link>
        <Link to="/reader/$bookId" params={{ bookId: book.id }} className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{book.title}</p>
          <p className="truncate text-[11px] italic text-muted-foreground">
            {playing ? line : "Paused"}
          </p>
        </Link>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="grid size-9 place-items-center rounded-full bg-accent/10 text-accent transition-colors hover:bg-accent/15"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close mini player"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
