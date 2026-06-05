import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { ReaderSettings } from "@/lib/books";

type ViewerStatus = "idle" | "loading" | "ready" | "error";
const READABLE_BLOCK_SELECTOR = "p, li, blockquote, h1, h2, h3, h4, h5, h6";
const STYLE_ELEMENT_ID = "readflow-speech-styles";

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
  highlightStyle?: ReaderSettings["highlight"];
  onLocationChange?: (location: ViewerLocation) => void;
}

export interface EpubViewerHandle {
  next: () => Promise<void>;
  prev: () => Promise<void>;
  getVisibleText: () => string;
  setSpeechProgress: (charIndex: number) => void;
  clearSpeechHighlight: () => void;
}

function getReadableBlocks(doc: Document) {
  return Array.from(doc.querySelectorAll<HTMLElement>(READABLE_BLOCK_SELECTOR)).filter(
    (element) => {
      const text = element.innerText?.trim() ?? "";
      return text.length > 0;
    },
  );
}

function ensureSpeechStyles(doc: Document, highlightStyle: ReaderSettings["highlight"]) {
  const existing = doc.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  const style = existing ?? doc.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    [data-readflow-block] {
      transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease, opacity 180ms ease;
      --readflow-progress: 0%;
    }
    [data-readflow-block][data-readflow-state="inactive"] {
      opacity: 0.58;
    }
    [data-readflow-block][data-readflow-state="active"] {
      opacity: 1;
    }
    [data-readflow-highlight="soft"] [data-readflow-block][data-readflow-state="active"] {
      background:
        linear-gradient(
          to right,
          rgba(182, 214, 141, 0.42) 0,
          rgba(182, 214, 141, 0.42) var(--readflow-progress),
          rgba(182, 214, 141, 0.18) var(--readflow-progress),
          rgba(182, 214, 141, 0.18) 100%
        );
      border-radius: 0.35rem;
      box-shadow: inset 0 0 0 1px rgba(126, 168, 74, 0.15);
    }
    [data-readflow-highlight="underline"] [data-readflow-block][data-readflow-state="active"] {
      background-image:
        linear-gradient(
          to right,
          rgba(95, 138, 54, 0.95) 0,
          rgba(95, 138, 54, 0.95) var(--readflow-progress),
          rgba(95, 138, 54, 0.22) var(--readflow-progress),
          rgba(95, 138, 54, 0.22) 100%
        );
      background-repeat: no-repeat;
      background-size: 100% 2px;
      background-position: 0 calc(100% - 0.08em);
    }
    [data-readflow-highlight="bar"] [data-readflow-block][data-readflow-state="active"] {
      border-left: 3px solid rgba(95, 138, 54, 0.95);
      padding-left: 0.75rem;
      margin-left: -0.75rem;
      background:
        linear-gradient(
          to right,
          rgba(182, 214, 141, 0.28) 0,
          rgba(182, 214, 141, 0.28) var(--readflow-progress),
          rgba(182, 214, 141, 0.12) var(--readflow-progress),
          rgba(182, 214, 141, 0.12) 100%
        );
    }
  `;

  doc.documentElement.setAttribute("data-readflow-highlight", highlightStyle);
  if (!existing) {
    doc.head.appendChild(style);
  }
}

function updateSpeechHighlight(
  contents: Array<{ document?: Document }>,
  highlightStyle: ReaderSettings["highlight"],
  charIndex: number | null,
) {
  let runningOffset = 0;

  contents.forEach((content) => {
    const doc = content.document;
    if (!doc) return;

    ensureSpeechStyles(doc, highlightStyle);
    const blocks = getReadableBlocks(doc);

    blocks.forEach((block, blockIndex) => {
      const text = block.innerText?.trim() ?? "";
      const start = runningOffset;
      const end = start + text.length;
      const nextOffset = end + 2;
      let state = "idle";
      let progress = 0;

      if (charIndex == null) {
        state = "idle";
      } else if (charIndex >= start && charIndex <= end) {
        state = "active";
        progress =
          text.length > 0 ? Math.max(0, Math.min(1, (charIndex - start) / text.length)) : 0;
      } else if (charIndex > end) {
        state = "inactive";
        progress = 1;
      } else {
        state = "idle";
        progress = 0;
      }

      block.setAttribute("data-readflow-block", `${blockIndex}`);
      block.setAttribute("data-readflow-state", state);
      block.style.setProperty("--readflow-progress", `${Math.round(progress * 100)}%`);
      if (state === "active") {
        block.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      runningOffset = nextOffset;
    });
  });
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  {
    source,
    className,
    initialLocationCfi,
    initialLocationHref,
    highlightStyle = "soft",
    onLocationChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const initialLocationRef = useRef(initialLocationCfi ?? initialLocationHref);
  const highlightStyleRef = useRef<ReaderSettings["highlight"]>(highlightStyle);
  const renditionRef = useRef<{
    display?: (target?: string) => Promise<void>;
    prev?: () => Promise<void>;
    next?: () => Promise<void>;
    getContents?: () => Array<{ document?: Document }>;
    destroy?: () => void;
    on?: (
      event: string,
      cb: (location: { start?: { cfi?: string; href?: string; percentage?: number } }) => void,
    ) => void;
  } | null>(null);
  const speechProgressRef = useRef<number | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    highlightStyleRef.current = highlightStyle;
  }, [highlightStyle]);

  useImperativeHandle(
    ref,
    () => ({
      next: async () => {
        await renditionRef.current?.next?.();
      },
      prev: async () => {
        await renditionRef.current?.prev?.();
      },
      getVisibleText: () => {
        const contents = renditionRef.current?.getContents?.() ?? [];
        return contents
          .flatMap((content) => (content.document ? getReadableBlocks(content.document) : []))
          .map((block) => block.innerText?.trim() ?? "")
          .filter(Boolean)
          .join("\n\n");
      },
      setSpeechProgress: (charIndex: number) => {
        speechProgressRef.current = charIndex;
        const contents = renditionRef.current?.getContents?.() ?? [];
        updateSpeechHighlight(contents, highlightStyleRef.current, charIndex);
      },
      clearSpeechHighlight: () => {
        speechProgressRef.current = null;
        const contents = renditionRef.current?.getContents?.() ?? [];
        updateSpeechHighlight(contents, highlightStyleRef.current, null);
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let destroyed = false;
    let openPromise: Promise<unknown> | null = null;
    let bookInstance: {
      destroy?: () => void;
      open?: (input: ArrayBuffer | string, openAs?: string) => Promise<unknown>;
      renderTo?: (
        element: HTMLDivElement,
        options: Record<string, unknown>,
      ) => {
        display?: (target?: string) => Promise<void>;
        prev?: () => Promise<void>;
        next?: () => Promise<void>;
        getContents?: () => Array<{ document?: Document }>;
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
      getContents?: () => Array<{ document?: Document }>;
      on?: (
        event: string,
        cb: (location: { start?: { cfi?: string; href?: string; percentage?: number } }) => void,
      ) => void;
    } | null = null;

    const destroyViewer = () => {
      if (destroyed) return;
      destroyed = true;

      renditionRef.current = null;

      const viewport = (
        renditionInstance as {
          viewport?: {
            resized?: (entries: unknown[]) => void;
            rect?: object | undefined;
            resizeFunc?: { disconnect?: () => void };
          } | null;
        } | null
      )?.viewport;
      if (viewport) {
        viewport.resized = () => {};
        viewport.rect = viewport.rect ?? {};
        try {
          viewport.resizeFunc?.disconnect?.();
        } catch (error) {
          console.warn("Failed to disconnect viewport resize observer cleanly", error);
        }
      }

      try {
        renditionInstance?.destroy?.();
      } catch (error) {
        console.warn("Failed to dispose rendition cleanly", error);
      }

      try {
        bookInstance?.destroy?.();
      } catch (error) {
        console.warn("Failed to dispose book cleanly", error);
      }
    };

    const mountViewer = async () => {
      if (!containerRef.current) return;

      setStatus("loading");
      setErrorMessage(null);

      try {
        const [{ default: createEpub }] = await Promise.all([import("@intity/epub-js")]);
        if (cancelled || !containerRef.current) return;

        bookInstance = createEpub({ replacements: "blobUrl" });
        openPromise = bookInstance.open?.(source, "binary") ?? null;
        await openPromise;
        if (cancelled || !containerRef.current) {
          destroyViewer();
          return;
        }

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
            href && bookInstance?.navigation?.get
              ? bookInstance.navigation.get(href)?.label
              : undefined;

          onLocationChangeRef.current?.({
            cfi: location?.start?.cfi,
            href,
            percentage: location?.start?.percentage,
            chapterLabel,
          });

          const contents = renditionRef.current?.getContents?.() ?? [];
          updateSpeechHighlight(contents, highlightStyleRef.current, speechProgressRef.current);
        });

        await renditionInstance.display?.(initialLocationRef.current);
        if (cancelled) {
          destroyViewer();
          return;
        }

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        console.error("Failed to render EPUB", error);
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Unable to open this EPUB.");
        } else {
          destroyViewer();
        }
      }
    };

    void mountViewer();

    return () => {
      cancelled = true;
      speechProgressRef.current = null;

      if (openPromise) {
        void openPromise.finally(() => {
          destroyViewer();
        });
        return;
      }

      destroyViewer();
    };
  }, [source]);

  useEffect(() => {
    const contents = renditionRef.current?.getContents?.() ?? [];
    updateSpeechHighlight(contents, highlightStyle, speechProgressRef.current);
  }, [highlightStyle]);

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
