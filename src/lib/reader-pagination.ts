import type { EpubTextSection } from "@/lib/epub-text";

const TARGET_PAGE_CHAR_COUNT = 1100;
const HARD_MAX_PAGE_CHAR_COUNT = 1450;
const MIN_PARAGRAPHS_PER_PAGE = 2;
const MAX_PARAGRAPHS_PER_PAGE = 5;

export interface ReaderPage {
  id: string;
  pageIndex: number;
  pageCount: number;
  startParagraphIndex: number;
  endParagraphIndex: number;
  paragraphs: string[];
}

function shouldCommitPage(
  paragraphs: string[],
  charCount: number,
  nextParagraphLength: number,
): boolean {
  if (paragraphs.length === 0) return false;
  if (paragraphs.length >= MAX_PARAGRAPHS_PER_PAGE) return true;
  if (paragraphs.length >= MIN_PARAGRAPHS_PER_PAGE && charCount >= TARGET_PAGE_CHAR_COUNT) {
    return true;
  }
  return charCount + nextParagraphLength > HARD_MAX_PAGE_CHAR_COUNT;
}

export function paginateSection(section: EpubTextSection): ReaderPage[] {
  const pages: ReaderPage[] = [];
  let currentParagraphs: string[] = [];
  let currentStart = 0;
  let currentChars = 0;

  section.paragraphs.forEach((paragraph, index) => {
    const length = paragraph.length;
    if (shouldCommitPage(currentParagraphs, currentChars, length)) {
      const pageIndex = pages.length;
      pages.push({
        id: `${section.href}:${pageIndex}`,
        pageIndex,
        pageCount: 0,
        startParagraphIndex: currentStart,
        endParagraphIndex: index - 1,
        paragraphs: currentParagraphs,
      });
      currentParagraphs = [];
      currentStart = index;
      currentChars = 0;
    }

    currentParagraphs.push(paragraph);
    currentChars += length;
  });

  if (currentParagraphs.length > 0) {
    const pageIndex = pages.length;
    pages.push({
      id: `${section.href}:${pageIndex}`,
      pageIndex,
      pageCount: 0,
      startParagraphIndex: currentStart,
      endParagraphIndex: section.paragraphs.length - 1,
      paragraphs: currentParagraphs,
    });
  }

  if (pages.length === 0) {
    pages.push({
      id: `${section.href}:0`,
      pageIndex: 0,
      pageCount: 1,
      startParagraphIndex: 0,
      endParagraphIndex: 0,
      paragraphs: ["This section does not contain readable text."],
    });
  }

  return pages.map((page, pageIndex, allPages) => ({
    ...page,
    pageIndex,
    pageCount: allPages.length,
  }));
}

export function resolvePagePosition(
  pages: ReaderPage[],
  options?: {
    pageIndex?: number;
    paragraphIndex?: number;
    activeLine?: number;
  },
) {
  if (pages.length === 0) {
    return { pageIndex: 0, activeLine: 0 };
  }

  if (typeof options?.paragraphIndex === "number") {
    const pageIndex = pages.findIndex(
      (page) =>
        options.paragraphIndex! >= page.startParagraphIndex &&
        options.paragraphIndex! <= page.endParagraphIndex,
    );
    const resolvedPageIndex = pageIndex >= 0 ? pageIndex : 0;
    const page = pages[resolvedPageIndex] ?? pages[0]!;
    return {
      pageIndex: resolvedPageIndex,
      activeLine: Math.max(
        0,
        Math.min(page.paragraphs.length - 1, options.paragraphIndex! - page.startParagraphIndex),
      ),
    };
  }

  const resolvedPageIndex = Math.max(0, Math.min(options?.pageIndex ?? 0, pages.length - 1));
  const page = pages[resolvedPageIndex] ?? pages[0]!;
  return {
    pageIndex: resolvedPageIndex,
    activeLine: Math.max(0, Math.min(options?.activeLine ?? 0, page.paragraphs.length - 1)),
  };
}

export function getBookProgress(section: EpubTextSection, page: ReaderPage) {
  const sectionProgress = section.index / Math.max(section.totalSections, 1);
  const pageProgress = (page.pageIndex + 1) / Math.max(page.pageCount, 1) / section.totalSections;
  return Math.min(1, Math.max(0, sectionProgress + pageProgress));
}
