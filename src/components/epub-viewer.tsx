import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

type ViewerStatus = "idle" | "loading" | "ready" | "error";

interface EpubViewerProps {
  source: ArrayBuffer | string;
  className?: string;
  onLocationChange?: (cfi: string) => void;
}

export function EpubViewer({ source, className, onLocationChange }: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let bookInstance: { destroy?: () => void } | null = null;
    let renditionInstance: { destroy?: () => void; on?: (event: string, cb: (location: { start?: { cfi?: string } }) => void) => void } | null = null;

    const mountViewer = async () => {
      if (!containerRef.current) return;

      setStatus("loading");
      setErrorMessage(null);

      try {
        const [{ default: createEpub }] = await Promise.all([import("@intity/epub-js")]);
        if (cancelled || !containerRef.current) return;

        bookInstance = createEpub(source);
        renditionInstance = bookInstance.renderTo(containerRef.current, {
          width: "100%",
          height: "100%",
          manager: "continuous",
          flow: "scrolled-doc",
          pageWidth: 720,
        });

        renditionInstance.on?.("relocated", (location) => {
          const cfi = location?.start?.cfi;
          if (cfi) {
            onLocationChange?.(cfi);
          }
        });

        await renditionInstance.display();
        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        console.error("Failed to render EPUB", error);
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Unable to open this EPUB.");
        }
      }
    };

    void mountViewer();

    return () => {
      cancelled = true;
      renditionInstance?.destroy?.();
      bookInstance?.destroy?.();
    };
  }, [onLocationChange, source]);

  return (
    <div className={className}>
      <div className="relative h-full min-h-[28rem] overflow-hidden rounded-[2rem] border border-border bg-card">
        <div ref={containerRef} className="h-full w-full" />

        {status === "loading" ? (
          <div className="absolute inset-0 grid place-items-center bg-card/90">
            <div className="flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Preparing your book
            </div>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 grid place-items-center bg-card/95 p-6 text-center">
            <div>
              <p className="font-medium text-foreground">This EPUB could not be rendered.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {errorMessage ?? "Try importing the file again or choose another book."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
