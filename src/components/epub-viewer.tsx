import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
  return Array.from(doc.querySelectorAll<HTMLElement>(READABLE_BLOCK_SELECTOR)).filter((element) => {
    const text = element.innerText?.trim() ?? "";
    return text.length > 0;
  });
}

function ensureSpeechStyles(doc: Document, highlightStyle: ReaderSettings["highlight"]) {
  const existing = doc.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  const style = existing ?? doc.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    [data-readflow-block] {
      transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease, opacity 180ms ease;
    }
    [data-readflow-block][data-readflow-state="inactive"] {
      opacity: 0.58;
    }
    [data-readflow-block][data-readflow-state="active"] {
      opacity: 1;
    }
    [data-readflow-highlight="soft"] [data-readflow-block][data-readflow-state="active"] {
      background: rgba(182, 214, 141, 0.34);
      border-radius: 0.35rem;
      box-shadow: inset 0 0 0 1px rgba(126, 168, 74, 0.15);
    }
    [data-readflow-highlight="underline"] [data-readflow-block][data-readflow-state="active"] {
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-decoration-color: rgba(95, 138, 54, 0.9);
      text-underline-offset: 0.28em;
    }
    [data-readflow-highlight="bar"] [data-readflow-block][data-readflow-state="active"] {
      border-left: 3px solid rgba(95, 138, 54, 0.95);
      padding-left: 0.75rem;
      margin-left: -0.75rem;
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

      if (charIndex == null) {
        state = "idle";
      } else if (charIndex >= start && charIndex <= end) {
        state = "active";
      } else if (charIndex > end) {
        state = "inactive";
      } else {
        state = "idle";
      }

      block.setAttribute("data-readflow-block", `${blockIndex}`);
      block.setAttribute("data-readflow-state", state);
      runningOffset = nextOffset;
    });
  });
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  { source, className, initialLocationCfi, initialLocationHref, highlightStyle = "soft", onLocationChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
        updateSpeechHighlight(contents, highlightStyle, charIndex);
      },
      clearSpeechHighlight: () => {
        speechProgressRef.current = null;
        const contents = renditionRef.current?.getContents?.() ?? [];
        updateSpeechHighlight(contents, highlightStyle, null);
      },
    }),
    [highlightStyle],
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

          const contents = renditionRef.current?.getContents?.() ?? [];
          updateSpeechHighlight(contents, highlightStyle, speechProgressRef.current);
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
  }, [highlightStyle, initialLocationCfi, initialLocationHref, onLocationChange, source]);

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
