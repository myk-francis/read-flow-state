import type { Book, BookCoverTone } from "@/lib/books";

const FALLBACK_EXCERPT = [
  "Your EPUB is ready. The next step is wiring real navigation, playback, and synchronized highlighting to the rendered content.",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function toneFromHash(hash: number): BookCoverTone {
  const tones: BookCoverTone[] = ["warm", "cool", "sage", "ink"];
  return tones[hash % tones.length] ?? "sage";
}

function firstNavigationLabel(navigation: unknown) {
  if (!Array.isArray(navigation) || navigation.length === 0) return "Start";
  const firstItem = navigation[0] as { label?: unknown };
  return typeof firstItem?.label === "string" && firstItem.label.trim() ? firstItem.label : "Start";
}

export async function importEpubFile(file: File): Promise<{ assetId: string; book: Book }> {
  const [{ default: createEpub }, arrayBuffer] = await Promise.all([
    import("@intity/epub-js"),
    file.arrayBuffer(),
  ]);

  const epub = createEpub({ replacements: "blobUrl" });

  try {
    await epub.open(arrayBuffer, "binary");

    const metadata = epub.packaging?.metadata;
    const navigation = await epub.loaded.navigation.catch(() => []);

    const metadataTitle = metadata?.get?.("title");
    const metadataCreator = metadata?.get?.("creator");

    const title =
      typeof metadataTitle === "string" && metadataTitle.trim()
        ? metadataTitle.trim()
        : file.name.replace(/\.epub$/i, "");
    const author =
      typeof metadataCreator === "string" && metadataCreator.trim()
        ? metadataCreator.trim()
        : "Unknown author";

    const hash = hashString(`${title}:${author}:${file.name}:${file.size}`);
    const assetId = `book-${slugify(title) || "untitled"}-${hash.toString(36)}`;

    return {
      assetId,
      book: {
        id: assetId,
        title,
        author,
        progress: 0,
        chapter: firstNavigationLabel(navigation),
        pageIndex: 0,
        coverHue: hash % 360,
        coverTone: toneFromHash(hash),
        excerpt: FALLBACK_EXCERPT,
        activeLine: 0,
        importedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        source: {
          kind: "local",
          fileName: file.name,
          mimeType: file.type || "application/epub+zip",
          sizeBytes: file.size,
          assetId,
        },
      },
    };
  } finally {
    epub.destroy();
  }
}
