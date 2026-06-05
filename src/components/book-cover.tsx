import { cn } from "@/lib/utils";
import type { Book } from "@/lib/books";

const toneStyles: Record<Book["coverTone"], { bg: string; ink: string; band: string }> = {
  warm: { bg: "oklch(0.86 0.05 60)", ink: "oklch(0.28 0.04 50)", band: "oklch(0.55 0.08 40)" },
  cool: { bg: "oklch(0.84 0.04 230)", ink: "oklch(0.24 0.04 240)", band: "oklch(0.45 0.08 230)" },
  sage: { bg: "oklch(0.86 0.04 145)", ink: "oklch(0.26 0.04 150)", band: "oklch(0.45 0.06 145)" },
  ink: { bg: "oklch(0.22 0.01 60)", ink: "oklch(0.92 0.01 80)", band: "oklch(0.55 0.04 60)" },
};

interface Props {
  book: Pick<Book, "title" | "author" | "coverTone">;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BookCover({ book, className, size = "md" }: Props) {
  const tone = toneStyles[book.coverTone];
  const padding = size === "sm" ? "p-2" : size === "lg" ? "p-5" : "p-3";
  const titleSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-base" : "text-[11px]";
  const authorSize = size === "sm" ? "text-[7px]" : size === "lg" ? "text-[10px]" : "text-[8px]";

  return (
    <div
      className={cn(
        "relative aspect-2/3 w-full overflow-hidden rounded-md shadow-sm ring-1 ring-black/5",
        padding,
        className,
      )}
      style={{ background: tone.bg, color: tone.ink }}
    >
      <div
        className="absolute inset-x-0 top-1/3 h-px"
        style={{ background: tone.band, opacity: 0.4 }}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className={cn("font-serif italic leading-tight", titleSize)}>{book.title}</div>
        <div className={cn("uppercase tracking-[0.18em] opacity-70", authorSize)}>
          {book.author}
        </div>
      </div>
    </div>
  );
}
