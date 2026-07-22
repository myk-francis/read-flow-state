import type { EpubTextSection } from "@/lib/epub-text";
import type { ReaderTextUnit } from "@/lib/books";

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
  units: ReadingUnit[];
}

export interface ReadingUnit {
  text: string;
  paragraphIndex: number;
}

function shouldCommitPage(
  paragraphs: ReadingUnit[],
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

function splitIntoSentenceUnits(paragraph: string, paragraphIndex: number): ReadingUnit[] {
  const normalized = paragraph.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentenceMatches = normalized.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [normalized];
  const sentences = sentenceMatches
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return (sentences.length > 0 ? sentences : [normalized]).map((text) => ({
    text,
    paragraphIndex,
  }));
}

function buildReadingUnits(paragraphs: string[], textUnit: ReaderTextUnit): ReadingUnit[] {
  const units = paragraphs.flatMap((paragraph, paragraphIndex) =>
    textUnit === "paragraphs"
      ? [{ text: paragraph, paragraphIndex }]
      : splitIntoSentenceUnits(paragraph, paragraphIndex),
  );

  return units.length > 0
    ? units
    : [{ text: "This section does not contain readable text.", paragraphIndex: 0 }];
}

export function paginateSection(
  section: EpubTextSection,
  textUnit: ReaderTextUnit = "paragraphs",
): ReaderPage[] {
  const pages: ReaderPage[] = [];
  const readingUnits = buildReadingUnits(section.paragraphs, textUnit);
  let currentParagraphs: ReadingUnit[] = [];
  let currentChars = 0;

  readingUnits.forEach((unit) => {
    const length = unit.text.length;
    if (shouldCommitPage(currentParagraphs, currentChars, length)) {
      const pageIndex = pages.length;
      pages.push({
        id: `${section.href}:${pageIndex}`,
        pageIndex,
        pageCount: 0,
        startParagraphIndex: currentParagraphs[0]?.paragraphIndex ?? 0,
        endParagraphIndex: currentParagraphs[currentParagraphs.length - 1]?.paragraphIndex ?? 0,
        units: currentParagraphs,
      });
      currentParagraphs = [];
      currentChars = 0;
    }

    currentParagraphs.push(unit);
    currentChars += length;
  });

  if (currentParagraphs.length > 0) {
    const pageIndex = pages.length;
    pages.push({
      id: `${section.href}:${pageIndex}`,
      pageIndex,
      pageCount: 0,
      startParagraphIndex: currentParagraphs[0]?.paragraphIndex ?? 0,
      endParagraphIndex: currentParagraphs[currentParagraphs.length - 1]?.paragraphIndex ?? 0,
      units: currentParagraphs,
    });
  }

  if (pages.length === 0) {
    pages.push({
      id: `${section.href}:0`,
      pageIndex: 0,
      pageCount: 1,
      startParagraphIndex: 0,
      endParagraphIndex: 0,
      units: [{ text: "This section does not contain readable text.", paragraphIndex: 0 }],
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
    const activeLine = page.units.findIndex(
      (unit) => unit.paragraphIndex === options.paragraphIndex,
    );
    return {
      pageIndex: resolvedPageIndex,
      activeLine: activeLine >= 0 ? activeLine : 0,
    };
  }

  const resolvedPageIndex = Math.max(0, Math.min(options?.pageIndex ?? 0, pages.length - 1));
  const page = pages[resolvedPageIndex] ?? pages[0]!;
  return {
    pageIndex: resolvedPageIndex,
    activeLine: Math.max(0, Math.min(options?.activeLine ?? 0, page.units.length - 1)),
  };
}

export function getBookProgress(section: EpubTextSection, page: ReaderPage) {
  const sectionProgress = section.index / Math.max(section.totalSections, 1);
  const pageProgress = (page.pageIndex + 1) / Math.max(page.pageCount, 1) / section.totalSections;
  return Math.min(1, Math.max(0, sectionProgress + pageProgress));
}
