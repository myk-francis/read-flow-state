import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { LoaderCircle } from "lucide-react";

type ViewerStatus = "idle" | "loading" | "ready" | "error";

export interface ViewerLocation {
  cfi?: string;
  href?: string;
  percentage?: number;
  chapterLabel?: string;
}

interface EpubViewerProps {
  source: ArrayBuffer | string;
  className?: string;
  initialLocationCfi?: string;
  initialLocationHref?: string;
  onLocationChange?: (location: ViewerLocation) => void;
}

export interface EpubViewerHandle {
  next: () => Promise<void>;
  prev: () => Promise<void>;
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  { source, className, initialLocationCfi, initialLocationHref, onLocationChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<{
    display?: (target?: string) => Promise<void>;
    prev?: () => Promise<void>;
    next?: () => Promise<void>;
    destroy?: () => void;
    on?: (
      event: string,
      cb: (location: { start?: { cfi?: string; href?: string; percentage?: number } }) => void,
    ) => void;
  } | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      next: async () => {
        await renditionRef.current?.next?.();
      },
      prev: async () => {
        await renditionRef.current?.prev?.();
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let bookInstance: {
      destroy?: () => void;
      renderTo?: (
        element: HTMLDivElement,
        options: Record<string, unknown>,
      ) => {
        display?: (target?: string) => Promise<void>;
        prev?: () => Promise<void>;
        next?: () => Promise<void>;
        destroy?: () => void;
        on?: (
          event: string,
          cb: (location: { start?: { cfi?: string; href?: string; percentage?: number } }) => void,
        ) => void;
      };
      navigation?: { get?: (href: string) => { label?: string } | undefined };
    } | null = null;
    let renditionInstance: {
      destroy?: () => void;
      display?: (target?: string) => Promise<void>;
      prev?: () => Promise<void>;
      next?: () => Promise<void>;
      on?: (
        event: string,
        cb: (location: { start?: { cfi?: string; href?: string; percentage?: number } }) => void,
      ) => void;
    } | null = null;

    const mountViewer = async () => {
      if (!containerRef.current) return;

      setStatus("loading");
      setErrorMessage(null);

      try {
        const [{ default: createEpub }] = await Promise.all([import("@intity/epub-js")]);
        if (cancelled || !containerRef.current) return;

        bookInstance = createEpub(source);
        renditionInstance = bookInstance.renderTo?.(containerRef.current, {
          width: "100%",
          height: "100%",
          manager: "continuous",
          flow: "scrolled-doc",
          pageWidth: 720,
        });

        renditionRef.current = renditionInstance ?? null;

        renditionInstance.on?.("relocated", (location) => {
          const href = location?.start?.href;
          const chapterLabel =
            href && bookInstance?.navigation?.get ? bookInstance.navigation.get(href)?.label : undefined;

          onLocationChange?.({
            cfi: location?.start?.cfi,
            href,
            percentage: location?.start?.percentage,
            chapterLabel,
          });
        });

        await renditionInstance.display?.(initialLocationCfi ?? initialLocationHref);
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
      renditionRef.current = null;
      renditionInstance?.destroy?.();
      bookInstance?.destroy?.();
    };
  }, [initialLocationCfi, initialLocationHref, onLocationChange, source]);

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
});
