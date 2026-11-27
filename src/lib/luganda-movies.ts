import rawMovies from "@/data/luganda-movies.json";

export type LugandaMovie = {
  title: string;
  year: number;
  vj: string;
  href: string;
};

export type VjSummary = {
  name: string;
  count: number;
};

const movies = rawMovies as LugandaMovie[];

const BY_VJ_SUFFIX =
  /\s+by\s+(?:vj\s+)?(?:ice\s*p|junior|emmy|kevo|muba|jingo|kevin|mark|lance|ulio)\b.*$/i;
const PART_SUFFIX = /\s+part\s*(\d+)\s*$/i;

export function cleanLugandaTitle(title: string): string {
  return title.replace(BY_VJ_SUFFIX, "").replace(PART_SUFFIX, "").trim();
}

export function normalizeMovieTitle(title: string): string {
  return cleanLugandaTitle(title)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entryWithPartLabel(entry: LugandaMovie): LugandaMovie {
  const partMatch = entry.title.match(PART_SUFFIX);
  if (!partMatch?.[1]) return entry;
  return { ...entry, vj: `${entry.vj} · Part ${partMatch[1]}` };
}

const indexByTitle = new Map<string, LugandaMovie[]>();
const entriesWithKey: { key: string; entry: LugandaMovie }[] = [];
for (const entry of movies) {
  const key = normalizeMovieTitle(entry.title);
  if (!key) continue;
  const list = indexByTitle.get(key);
  if (list) list.push(entry);
  else indexByTitle.set(key, [entry]);
  entriesWithKey.push({ key, entry });
}

function dedupeStreams(list: LugandaMovie[]): LugandaMovie[] {
  const seen = new Set<string>();
  const out: LugandaMovie[] = [];
  for (const item of list) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    out.push(entryWithPartLabel(item));
  }
  return out;
}

export function findLugandaStreams(
  title: string,
  year?: string | number | null,
): LugandaMovie[] {
  const norm = normalizeMovieTitle(title);
  if (!norm) return [];
  const parsedYear = typeof year === "number" ? year : Number.parseInt(year ?? "", 10);
  const candidates = indexByTitle.get(norm);

  if (candidates && candidates.length > 0) {
    if (!Number.isFinite(parsedYear)) return dedupeStreams(candidates);
    const exact = candidates.filter((m) => m.year === parsedYear);
    if (exact.length > 0) return dedupeStreams(exact);
    const near = candidates.filter((m) => Math.abs(m.year - parsedYear) <= 1);
    if (near.length > 0) return dedupeStreams(near);
    return [];
  }

  if (!Number.isFinite(parsedYear)) return [];
  const prefixMatches = entriesWithKey
    .filter(
      ({ key, entry }) =>
        key.length >= 6 &&
        Math.abs(entry.year - parsedYear) <= 1 &&
        (norm.startsWith(`${key} `) || key.startsWith(`${norm} `)),
    )
    .map(({ entry }) => entry);
  return dedupeStreams(prefixMatches);
}

export type LugandaCardInfo = {
  translated: boolean;
  vj: string | null;
};

export function getLugandaCardInfo(
  title: string,
  year?: string | number | null,
  preferredVj?: string,
): LugandaCardInfo {
  const rawVj = preferredVj ?? findLugandaStreams(title, year)[0]?.vj;
  if (!rawVj) return { translated: false, vj: null };
  const vj = rawVj.replace(/\s*·\s*Part\s*\d+$/i, "").trim();
  if (!vj || vj === "Luganda Translated") return { translated: true, vj: null };
  return { translated: true, vj };
}

export function getLugandaBadgeLabel(
  title: string,
  year?: string | number | null,
  preferredVj?: string,
): string | null {
  const info = getLugandaCardInfo(title, year, preferredVj);
  if (!info.translated) return null;
  return info.vj ? `Translated · ${info.vj}` : "Translated";
}

export function catalogKey(entry: Pick<LugandaMovie, "title" | "year">): string {
  return `${normalizeMovieTitle(entry.title)}-${entry.year}`;
}

function uniqueSorted(list: LugandaMovie[], excludeKeys?: Set<string>): LugandaMovie[] {
  const sorted = [...list].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  const seen = new Set<string>(excludeKeys);
  const out: LugandaMovie[] = [];
  for (const item of sorted) {
    const key = catalogKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function listVjs(): VjSummary[] {
  const byVj = new Map<string, Set<string>>();
  for (const entry of movies) {
    if (!entry.vj || entry.vj === "Luganda Translated") continue;
    const key = catalogKey(entry);
    let set = byVj.get(entry.vj);
    if (!set) {
      set = new Set();
      byVj.set(entry.vj, set);
    }
    set.add(key);
  }
  return [...byVj.entries()]
    .filter(([, keys]) => keys.size > 0)
    .map(([name, keys]) => ({ name, count: keys.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Deterministic PRNG so one rotation window serves the same picks everywhere. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(list: T[], seed: number): T[] {
  const rand = seededRandom(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Changes every few hours so the homepage rotates without flickering on each visit. */
export function rotationSeed(now = Date.now(), hours = 3): number {
  return Math.floor(now / (hours * 3_600_000));
}

/** A rotating pick of a VJ's titles, drawn from its newest pool of releases. */
export function getRotatingVjPicks(vj: string, count: number, seed: number, pool = 40): LugandaMovie[] {
  const unique = uniqueSorted(vj === "all" ? movies : movies.filter((m) => m.vj === vj));
  return seededShuffle(unique.slice(0, pool), seed + vj.length * 7919).slice(0, count);
}

export function getFeaturedLugandaCatalog(limit: number, seed?: number): LugandaMovie[] {
  const queues = listVjs()
    .slice(0, 6)
    .map((v) => {
      const list = uniqueSorted(movies.filter((m) => m.vj === v.name));
      return seed === undefined ? list : seededShuffle(list.slice(0, 40), seed + v.name.length);
    });
  const seen = new Set<string>();
  const out: LugandaMovie[] = [];
  let round = 0;
  while (out.length < limit) {
    let added = false;
    for (const q of queues) {
      while (round < q.length) {
        const item = q[round];
        if (!item) break;
        const key = catalogKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(item);
          added = true;
          break;
        }
        q.splice(round, 1);
      }
      if (out.length >= limit) break;
    }
    if (!added) break;
    round += 1;
  }
  return out;
}

export function getVjCatalog(
  vj: string,
  offset: number,
  limit: number,
  excludeKeys?: Set<string>,
): { items: LugandaMovie[]; hasMore: boolean; total: number } {
  const filtered = vj === "all" ? movies : movies.filter((m) => m.vj === vj);
  const unique = uniqueSorted(filtered, excludeKeys);
  const items = unique.slice(offset, offset + limit);
  return { items, hasMore: offset + limit < unique.length, total: unique.length };
}