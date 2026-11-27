import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  catalogKey,
  cleanLugandaTitle,
  getFeaturedLugandaCatalog,
  getVjCatalog,
  listVjs,
  type LugandaMovie,
} from "./luganda-movies";
import { GENRES, getAllCategories, getCategoryBySlug } from "./categories";

export type MediaKind = "movie" | "tv";
export type MediaCardData = {
  id: number;
  kind: MediaKind;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: string;
  rating: number;
  overview: string;
  lugandaVj?: string;
  genreIds?: number[];
};
export type MediaDetail = MediaCardData & {
  genres: string[];
  runtime: string;
  tagline: string;
  trailerKey: string | null;
  cast: { name: string; character: string; photo: string | null }[];
  similar: MediaCardData[];
};

const IMG = "https://image.tmdb.org/t/p/";

async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = process.env["TMDB_API_KEY"];
  if (!key) throw new Error("Movie data key is missing");
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  if (key.length > 40) headers["Authorization"] = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Movie data request failed (${res.status})`);
  return (await res.json()) as any;
}

function toCard(r: any, fallback?: MediaKind): MediaCardData | null {
  const kind: MediaKind = r.media_type === "tv" || r.media_type === "movie" ? r.media_type : (fallback ?? "movie");
  if (r.media_type === "person") return null;
  return {
    id: r.id,
    kind,
    title: r.title ?? r.name ?? "Untitled",
    poster: r.poster_path ? `${IMG}w342${r.poster_path}` : null,
    backdrop: r.backdrop_path ? `${IMG}w1280${r.backdrop_path}` : null,
    year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
    rating: Math.round((r.vote_average ?? 0) * 10) / 10,
    overview: r.overview ?? "",
    genreIds: r.genre_ids ?? (r.genres ?? []).map((genre: { id: number }) => genre.id),
  };
}
const cards = (list: any[], k?: MediaKind) =>
  list.map((r) => toCard(r, k)).filter((x): x is MediaCardData => !!x);

const lugandaTmdbCache = new Map<string, MediaCardData | null>();

async function resolveOneLuganda(entry: LugandaMovie): Promise<MediaCardData | null> {
  const key = catalogKey(entry);
  if (lugandaTmdbCache.has(key)) {
    const cached = lugandaTmdbCache.get(key);
    return cached ? { ...cached, lugandaVj: entry.vj } : null;
  }
  const query = cleanLugandaTitle(entry.title);
  if (!query) return null;
  try {
    let res = await tmdb("/search/movie", {
      query,
      year: String(entry.year),
      include_adult: "false",
    });
    let hits: any[] = res.results ?? [];
    if (hits.length === 0) {
      res = await tmdb("/search/movie", { query, include_adult: "false" });
      hits = (res.results ?? []).filter((h: any) => {
        const y = Number.parseInt((h.release_date ?? "").slice(0, 4), 10);
        return !Number.isFinite(y) || Math.abs(y - entry.year) <= 2;
      });
    }
    const best =
      hits.find((h) => h.backdrop_path) ?? hits.find((h) => h.poster_path) ?? hits[0] ?? null;
    const card = best ? toCard(best, "movie") : null;
    lugandaTmdbCache.set(key, card);
    return card ? { ...card, lugandaVj: entry.vj } : null;
  } catch {
    return null;
  }
}

async function resolveLugandaBatch(entries: LugandaMovie[]): Promise<MediaCardData[]> {
  const out: MediaCardData[] = [];
  const seenIds = new Set<number>();
  for (let i = 0; i < entries.length; i += 10) {
    const resolved = await Promise.all(entries.slice(i, i + 10).map(resolveOneLuganda));
    for (const card of resolved) {
      if (!card || seenIds.has(card.id)) continue;
      seenIds.add(card.id);
      out.push(card);
    }
  }
  return out;
}

let translatedIndex: Promise<Map<string, MediaCardData>> | null = null;

async function getTranslatedIndex(): Promise<Map<string, MediaCardData>> {
  if (translatedIndex) return translatedIndex;
  translatedIndex = (async () => {
    const entries = getVjCatalog("all", 0, Number.MAX_SAFE_INTEGER).items;
    const index = new Map<string, MediaCardData>();
    let next = 0;
    // Bound upstream concurrency and share one catalog resolution across all shelves.
    await Promise.all(Array.from({ length: 16 }, async () => {
      while (next < entries.length) {
        const entry = entries[next++];
        if (!entry) continue;
        const card = await resolveOneLuganda(entry);
        if (card) index.set(catalogKey(entry), card);
      }
    }));
    return index;
  })();
  try {
    return await translatedIndex;
  } catch (error) {
    translatedIndex = null;
    throw error;
  }
}

function translatedGenreItems(index: Map<string, MediaCardData>, genreId: number) {
  const entries = getVjCatalog("all", 0, Number.MAX_SAFE_INTEGER).items;
  const seen = new Set<number>();
  return entries.flatMap((entry) => {
    const card = index.get(catalogKey(entry));
    if (!card?.genreIds?.includes(genreId) || seen.has(card.id)) return [];
    seen.add(card.id);
    return [card];
  });
}

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  const vjs = listVjs();
  const featuredEntries = getFeaturedLugandaCatalog(14);
  const lists: [string, Promise<any>, MediaKind | undefined][] = [
    ...getAllCategories().flatMap((category) => category.source.type === "tmdb-list"
      ? [[category.title, tmdb(category.source.path), category.source.kind] as [string, Promise<any>, MediaKind | undefined]]
      : []),
    ...GENRES.map(([name, id]) => [name, tmdb("/discover/movie", { with_genres: String(id), sort_by: "popularity.desc" }), "movie"] as [string, Promise<any>, MediaKind]),
  ];
  const [index, results] = await Promise.all([
    getTranslatedIndex(),
    Promise.all(lists.map(([, p]) => p.catch(() => ({ results: [] })))),
  ]);
  const fromCatalog = (entries: LugandaMovie[]) => {
    const seen = new Set<number>();
    return entries.flatMap((entry) => {
      const card = index.get(catalogKey(entry));
      if (!card || seen.has(card.id)) return [];
      seen.add(card.id);
      return [{ ...card, lugandaVj: entry.vj }];
    });
  };
  const lugandaItems = fromCatalog(featuredEntries);
  const vjResolved = vjs.map((vj) => ({
    title: vj.name,
    items: fromCatalog(getVjCatalog(vj.name, 0, Number.MAX_SAFE_INTEGER).items).slice(0, 12),
  }));
  const translatedGenres = getAllCategories().flatMap((category) =>
    category.source.type === "luganda-genre"
      ? [{ title: category.title, items: translatedGenreItems(index, category.source.genreId).slice(0, 12) }]
      : []);
  const tmdbRows = lists
    .map(([title, , k], i) => ({ title, items: cards(results[i]?.results ?? [], k) }))
    .filter((r) => r.items.length);
  const rows = [
    ...(lugandaItems.length ? [{ title: "Luganda Translated", items: lugandaItems }] : []),
    ...vjResolved.filter((r) => r.items.length),
    ...translatedGenres.filter((r) => r.items.length),
    ...tmdbRows,
  ];
  const trending = tmdbRows.find((r) => r.title === "Trending now")?.items ?? [];
  const hero = lugandaItems.find((m) => m.backdrop) ?? trending.find((m) => m.backdrop) ?? null;
  let heroTrailer: string | null = null;
  if (hero) {
    try {
      const v = await tmdb(`/${hero.kind}/${hero.id}/videos`);
      const vids: any[] = v.results ?? [];
      heroTrailer = (vids.find((x) => x.site === "YouTube" && x.type === "Trailer") ?? vids.find((x) => x.site === "YouTube"))?.key ?? null;
    } catch {}
  }
  return { hero, heroTrailer, rows, vjs };
});

export const getExplorePage = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ page: z.number().int().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const r = await tmdb("/discover/movie", {
      sort_by: "popularity.desc",
      include_adult: "false",
      "vote_count.gte": "50",
      page: String(data.page),
    });
    const maxPage = Math.min(r.total_pages ?? 1, 500);
    return {
      items: cards(r.results ?? [], "movie"),
      nextPage: data.page < maxPage ? data.page + 1 : null,
    };
  });

export const getVjMoviesPage = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        vj: z.string().min(1).max(60),
        offset: z.number().int().min(0),
        limit: z.number().int().min(1).max(24).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 12;
    const { items: entries, hasMore, total } = getVjCatalog(data.vj, data.offset, limit);
    const items = await resolveLugandaBatch(entries);
    return {
      items,
      nextOffset: hasMore ? data.offset + limit : null,
      total,
    };
  });

export const getCategoryPage = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        page: z.number().int().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const category = getCategoryBySlug(data.slug);
    if (!category) return null;
    const { source } = category;
    if (source.type === "luganda-genre") {
      const all = translatedGenreItems(await getTranslatedIndex(), source.genreId);
      const offset = (data.page - 1) * 12;
      return {
        slug: category.slug,
        title: category.title,
        description: category.description,
        total: all.length,
        items: all.slice(offset, offset + 12),
        nextPage: offset + 12 < all.length ? data.page + 1 : null,
      };
    }
    if (source.type === "luganda-all" || source.type === "vj") {
      const limit = 12;
      const offset = (data.page - 1) * limit;
      const vjKey = source.type === "luganda-all" ? "all" : source.vj;
      const { items: entries, hasMore, total } = getVjCatalog(vjKey, offset, limit);
      const items = await resolveLugandaBatch(entries);
      return {
        slug: category.slug,
        title: category.title,
        description: category.description,
        total,
        items,
        nextPage: hasMore ? data.page + 1 : null,
      };
    }
    const r =
      source.type === "tmdb-genre"
        ? await tmdb("/discover/movie", {
            with_genres: String(source.genreId),
            sort_by: "popularity.desc",
            include_adult: "false",
            page: String(data.page),
          })
        : await tmdb(source.path, { page: String(data.page) });
    const maxPage = Math.min(r.total_pages ?? 1, 500);
    const kind = source.type === "tmdb-genre" ? "movie" : source.kind;
    return {
      slug: category.slug,
      title: category.title,
      description: category.description,
      total: typeof r.total_results === "number" ? r.total_results : null,
      items: cards(r.results ?? [], kind),
      nextPage: data.page < maxPage ? data.page + 1 : null,
    };
  });

export const searchMedia = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().max(100) }).parse(d))
  .handler(async ({ data }) => {
    if (!data.q.trim()) return [] as MediaCardData[];
    const r = await tmdb("/search/multi", { query: data.q, include_adult: "false" });
    return cards(r.results);
  });

export const getDetail = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ kind: z.enum(["movie", "tv"]), id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<MediaDetail> => {
    const r = await tmdb(`/${data.kind}/${data.id}`, { append_to_response: "videos,credits,similar" });
    const base = toCard(r, data.kind);
    if (!base) throw new Error("Movie or series is unavailable");
    const vids: any[] = r.videos?.results ?? [];
    const trailer =
      vids.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
      vids.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
      vids.find((v) => v.site === "YouTube");
    const mins = r.runtime ?? r.episode_run_time?.[0];
    return {
      ...base,
      genres: (r.genres ?? []).map((g: any) => g.name),
      runtime: data.kind === "tv" ? `${r.number_of_seasons ?? 0} seasons` : mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : "",
      tagline: r.tagline ?? "",
      trailerKey: trailer?.key ?? null,
      cast: (r.credits?.cast ?? []).slice(0, 12).map((c: any) => ({
        name: c.name,
        character: c.character ?? "",
        photo: c.profile_path ? `${IMG}w185${c.profile_path}` : null,
      })),
      similar: cards(r.similar?.results ?? [], data.kind).slice(0, 12),
    };
  });
