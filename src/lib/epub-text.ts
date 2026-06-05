const READABLE_BLOCK_SELECTOR = "p, li, blockquote, h1, h2, h3, h4, h5, h6, pre";
const FRONT_MATTER_PATTERNS = [
  /\btable of contents\b/i,
  /\bcontents\b/i,
  /\bcover\b/i,
  /\btitle page\b/i,
  /\bcopyright\b/i,
  /\backnowledg(e)?ments?\b/i,
  /\bdedication\b/i,
  /\bforeword\b/i,
  /\bpreface\b/i,
  /\bintroduction\b/i,
];

export interface EpubTextSection {
  href: string;
  chapter: string;
  paragraphs: string[];
  index: number;
  totalSections: number;
  progress: number;
  prevHref?: string;
  nextHref?: string;
}

export interface EpubReadingMapItem {
  href: string;
  label: string;
  index: number;
  progress: number;
}

export interface EpubTextReader {
  loadSection: (target?: string) => Promise<EpubTextSection>;
  getReadingMap: () => EpubReadingMapItem[];
  destroy: () => void;
}

interface EpubTextReaderOptions {
  title?: string;
  author?: string;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitIntoReadingLines(blocks: string[]) {
  const lines = blocks.flatMap((block) => {
    const normalized = normalizeText(block);
    if (!normalized) return [];

    const sentenceMatches = normalized.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [normalized];
    const sentences = sentenceMatches.map((sentence) => normalizeText(sentence)).filter(Boolean);

    return sentences.length > 0 ? sentences : [normalized];
  });

  return lines.length > 0 ? lines : blocks;
}

function humanizeHrefLabel(href: string, index: number) {
  const decoded = href.split("/").pop()?.split("#")[0] ?? href;
  const withoutExtension = decoded.replace(/\.[a-z0-9]+$/i, "");
  const normalized = withoutExtension.replace(/[_-]+/g, " ").trim();

  if (!normalized || /^text\d+$/i.test(normalized) || /^section\d+$/i.test(normalized)) {
    return `Chapter ${index + 1}`;
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractDocumentTitle(doc?: Document | null) {
  if (!doc) return null;

  const heading = Array.from(doc.querySelectorAll<HTMLElement>("h1, h2, h3, title"))
    .map((element) => normalizeText(element.textContent ?? ""))
    .find(Boolean);

  return heading || null;
}

function shouldSkipSection(label: string, href: string) {
  const candidate = `${label} ${href}`.trim();
  return FRONT_MATTER_PATTERNS.some((pattern) => pattern.test(candidate));
}

function looksLikeFrontMatterLine(line: string, options?: EpubTextReaderOptions) {
  const normalized = normalizeText(line);
  if (!normalized) return true;

  const lower = normalized.toLowerCase();
  if (FRONT_MATTER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (options?.title && lower === normalizeText(options.title).toLowerCase()) {
    return true;
  }

  if (options?.author && lower === normalizeText(options.author).toLowerCase()) {
    return true;
  }

  if (/^(chapter|book|part)\b/i.test(normalized) && normalized.length < 48) {
    return true;
  }

  if (/^\d+\.?\s+[A-Z]/.test(normalized) && normalized.length < 80) {
    return true;
  }

  return false;
}

function sanitizeParagraphs(paragraphs: string[], options?: EpubTextReaderOptions) {
  const filtered = paragraphs.filter((line) => !looksLikeFrontMatterLine(line, options));
  return filtered.length > 0 ? filtered : paragraphs;
}

function extractParagraphs(doc: Document, options?: EpubTextReaderOptions) {
  const blocks = Array.from(doc.querySelectorAll<HTMLElement>(READABLE_BLOCK_SELECTOR))
    .map((element) => normalizeText(element.innerText ?? element.textContent ?? ""))
    .filter(Boolean);

  if (blocks.length > 0) {
    return splitIntoReadingLines(sanitizeParagraphs(blocks, options));
  }

  const fallback = normalizeText(doc.body?.innerText ?? doc.documentElement?.textContent ?? "");
  return fallback
    ? splitIntoReadingLines(
        sanitizeParagraphs(fallback.split(/(?<=[.!?])\s+/).filter(Boolean), options),
      )
    : [];
}

function getPreferredStartSection(
  book: {
    sections: {
      values: () => Iterable<{
        linear: boolean;
        href: string;
        index: number;
      }>;
      first: () => unknown;
    };
    navigation?: {
      toc?: {
        get?: (href: string) => { label?: string } | undefined;
      };
    };
  },
  options?: EpubTextReaderOptions,
) {
  const sections = [...book.sections.values()].filter((section) => section.linear);

  for (const section of sections) {
    const navItem = book.navigation?.toc?.get?.(section.href);
    const chapter = navItem?.label?.trim() || section.href;
    if (shouldSkipSection(chapter, section.href)) {
      continue;
    }
    return section;
  }

  return book.sections.first();
}

async function buildReadingMap(
  book: {
    sections: {
      values: () => Iterable<{
        linear: boolean;
        href: string;
        index: number;
        load: (loader: unknown) => Promise<unknown>;
        document?: Document | null;
      }>;
      first: () => unknown;
      size?: number;
    };
    load: unknown;
    navigation?: {
      toc?: {
        get?: (href: string) => { label?: string } | undefined;
      };
    };
  },
  options?: EpubTextReaderOptions,
): EpubReadingMapItem[] {
  const sections = [...book.sections.values()].filter((section) => section.linear);
  const totalSections = Math.max(sections.length, 1);

  const items: EpubReadingMapItem[] = [];

  for (const section of sections) {
    const navItem = book.navigation?.toc?.get?.(section.href);
    let label = navItem?.label?.trim() || "";

    if (!label || label === section.href) {
      try {
        await section.load(book.load);
        label = extractDocumentTitle(section.document) || "";
      } catch {
        label = "";
      }
    }

    const resolvedLabel = label || humanizeHrefLabel(section.href, section.index);
    if (shouldSkipSection(resolvedLabel, section.href)) {
      continue;
    }

    items.push({
      href: section.href,
      label: resolvedLabel,
      index: section.index,
      progress: totalSections > 1 ? section.index / (totalSections - 1) : 0,
    });
  }

  if (items.length > 0) {
    return items;
  }

  const fallback = getPreferredStartSection(book, options);
  if (!fallback) {
    return [];
  }

  return [
    {
      href: fallback.href,
      label: humanizeHrefLabel(fallback.href, fallback.index),
      index: fallback.index,
      progress: 0,
    },
  ];
}

export async function createEpubTextReader(
  source: ArrayBuffer,
  options?: EpubTextReaderOptions,
): Promise<EpubTextReader> {
  const [{ default: createEpub }] = await Promise.all([import("@intity/epub-js")]);
  const book = createEpub({ replacements: "blobUrl" });
  await book.open(source, "binary");
  await book.loaded.sections;
  const readingMap = await buildReadingMap(book, options);

  return {
    async loadSection(target?: string) {
      const section = target ? book.section(target) : getPreferredStartSection(book, options);
      if (!section) {
        throw new Error("No readable sections were found in this EPUB.");
      }

      await section.load(book.load.bind(book));

      const paragraphs = section.document ? extractParagraphs(section.document, options) : [];
      const navItem = book.navigation?.toc?.get?.(section.href);
      const totalSections = Math.max(book.sections.size, 1);
      const progress = totalSections > 1 ? section.index / (totalSections - 1) : 0;
      const documentTitle = extractDocumentTitle(section.document);

      return {
        href: section.href,
        chapter:
          navItem?.label?.trim() || documentTitle || humanizeHrefLabel(section.href, section.index),
        paragraphs:
          paragraphs.length > 0 ? paragraphs : ["This section does not contain readable text."],
        index: section.index,
        totalSections,
        progress,
        prevHref: section.prev()?.href,
        nextHref: section.next()?.href,
      };
    },
    getReadingMap() {
      return readingMap;
    },
    destroy() {
      book.destroy();
    },
  };
}
