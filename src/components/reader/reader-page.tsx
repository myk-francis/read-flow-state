import { cn } from "@/lib/utils";

interface ReaderPageProps {
  pageKey: string;
  paragraphs: string[];
  activeLine: number;
  fontSize: number;
  lineHeight: number;
  highlight: "soft" | "underline" | "bar";
  registerLineRef: (index: number, element: HTMLParagraphElement | null) => void;
  onSelectLine: (index: number) => void;
}

export function ReaderPage({
  pageKey,
  paragraphs,
  activeLine,
  fontSize,
  lineHeight,
  highlight,
  registerLineRef,
  onSelectLine,
}: ReaderPageProps) {
  return (
    <article className="mx-auto max-w-[60ch] space-y-7 font-serif" style={{ fontSize, lineHeight }}>
      {paragraphs.map((paragraph, index) => {
        const active = index === activeLine;

        return (
          <p
            key={`${pageKey}-${index}`}
            ref={(element) => registerLineRef(index, element)}
            onClick={() => onSelectLine(index)}
            data-active={active}
            className={cn(
              "cursor-pointer text-pretty",
              highlight === "soft" && "reading-line",
              highlight === "underline" &&
                (active
                  ? "underline decoration-accent decoration-2 underline-offset-[6px]"
                  : "text-foreground/45"),
              highlight === "bar" &&
                (active
                  ? "border-l-2 border-accent pl-3"
                  : "border-l-2 border-transparent pl-3 text-foreground/45"),
            )}
          >
            {paragraph}
          </p>
        );
      })}
    </article>
  );
}
