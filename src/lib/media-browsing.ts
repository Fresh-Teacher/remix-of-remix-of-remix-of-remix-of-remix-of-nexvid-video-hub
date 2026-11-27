import type { MediaCardData } from "./tmdb.functions";
import { getCategoryBySlug, getCategorySlugByTitle } from "./categories";

export type MediaRow = { title: string; items: MediaCardData[] };

export function homeRows(rows: MediaRow[], excluded: MediaCardData[] = []): MediaRow[] {
  const seen = [...excluded];
  return rows.flatMap((row) => {
    const slug = getCategorySlugByTitle(row.title);
    const category = slug ? getCategoryBySlug(slug) : null;
    // VJs and translated genres are independent collections, not competing feeds.
    const independent = category?.group === "vj" || category?.group === "translated-genre";
    const fresh = uniqueRows([row], independent ? [] : seen);
    const selected = fresh.length ? fresh : uniqueRows([row]);
    seen.push(...selected.flatMap((shelf) => shelf.items));
    return selected;
  });
}

function isTranslatedRow(title: string): boolean {
  const slug = getCategorySlugByTitle(title);
  const group = slug ? getCategoryBySlug(slug)?.group : undefined;
  return group === "luganda" || group === "vj" || group === "translated-genre";
}

/** Jumbotron slides: translated movies only, interleaved across translated shelves. */
export function featuredSlides(rows: MediaRow[], limit = 7): MediaCardData[] {
  const translated = rows.filter((row) => isTranslatedRow(row.title));
  const seen = new Set<string>();
  const out: MediaCardData[] = [];
  const longest = Math.max(0, ...translated.map((r) => r.items.length));
  for (let i = 0; i < longest && out.length < limit; i++) {
    for (const row of translated) {
      const item = row.items[i];
      if (!item || out.length >= limit) continue;
      const key = `${item.kind}-${item.id}`;
      if (!item.backdrop || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

export function uniqueRows(
  rows: MediaRow[],
  excluded: Pick<MediaCardData, "id" | "kind">[] = [],
  limit = 20,
): MediaRow[] {
  const seen = new Set(excluded.map((m) => `${m.kind}-${m.id}`));
  return rows
    .map((row) => {
      const items: MediaCardData[] = [];
      for (const m of row.items) {
        const key = `${m.kind}-${m.id}`;
        if (seen.has(key) || items.length >= limit) continue;
        seen.add(key);
        items.push(m);
      }
      return { title: row.title, items };
    })
    .filter((row) => row.items.length > 0);
}

/**
 * Watch-page shelves: the movie's own category first (its VJ for translated titles,
 * otherwise similar titles), then every translated shelf, then TMDB shelves last.
 */
export function detailRows(
  detail: MediaCardData & { similar: MediaCardData[] },
  rows: MediaRow[],
  ownCategory?: string | null,
) {
  const own = ownCategory ? rows.find((r) => r.title === ownCategory) : undefined;
  const first: MediaRow = own
    ? { title: `More from ${own.title}`, items: own.items }
    : { title: "More like this", items: detail.similar };
  const rest = rows.filter((r) => r !== own);
  const translated = rest.filter((r) => isTranslatedRow(r.title));
  const tmdbRows = rest.filter((r) => !isTranslatedRow(r.title));
  return uniqueRows([first, ...translated, ...tmdbRows], [detail], 12);
}

export function dedupeAppend(
  existing: Pick<MediaCardData, "id" | "kind">[],
  incoming: MediaCardData[],
): MediaCardData[] {
  const seen = new Set(existing.map((m) => `${m.kind}-${m.id}`));
  const added: MediaCardData[] = [];
  for (const item of incoming) {
    const key = `${item.kind}-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(item);
  }
  return added;
}
