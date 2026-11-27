import { getVjCatalog, listVjs } from "./luganda-movies";

export const GENRES: [string, number][] = [
  ["Action Movies", 28],
  ["Comedy Movies", 35],
  ["Sci-Fi Movies", 878],
  ["Horror Movies", 27],
  ["Romance Movies", 10749],
  ["Animation", 16],
  ["Thrillers", 53],
  ["Crime Movies", 80],
  ["Adventure", 12],
  ["Documentaries", 99],
  ["Family Movies", 10751],
  ["Fantasy", 14],
  ["Drama Movies", 18],
  ["History Movies", 36],
  ["Music Movies", 10402],
  ["Mystery Movies", 9648],
  ["War Movies", 10752],
  ["Western Movies", 37],
  ["TV Movies", 10770],
];

export type CategorySource =
  | { type: "luganda-all" }
  | { type: "vj"; vj: string }
  | { type: "luganda-genre"; genreId: number }
  | { type: "tmdb-list"; path: string; kind?: "movie" | "tv" }
  | { type: "tmdb-genre"; genreId: number };

export type CategoryDef = {
  slug: string;
  title: string;
  description: string;
  group: "luganda" | "vj" | "translated-genre" | "featured" | "genre";
  source: CategorySource;
  count?: number;
};

export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CURATED_LISTS: Omit<CategoryDef, "slug">[] = [
  {
    title: "Trending now",
    description: "The movies and series everyone is watching this week.",
    group: "featured",
    source: { type: "tmdb-list", path: "/trending/all/week" },
  },
  {
    title: "Popular movies",
    description: "The most popular movies streaming and playing right now.",
    group: "featured",
    source: { type: "tmdb-list", path: "/movie/popular", kind: "movie" },
  },
  {
    title: "Now playing in cinemas",
    description: "Current cinema releases and trailers to discover.",
    group: "featured",
    source: { type: "tmdb-list", path: "/movie/now_playing", kind: "movie" },
  },
  {
    title: "Coming soon",
    description: "Upcoming releases and official trailers.",
    group: "featured",
    source: { type: "tmdb-list", path: "/movie/upcoming", kind: "movie" },
  },
  {
    title: "Top rated films",
    description: "Critically acclaimed movies loved by audiences.",
    group: "featured",
    source: { type: "tmdb-list", path: "/movie/top_rated", kind: "movie" },
  },
  {
    title: "Popular series",
    description: "Hit TV shows and binge-worthy series.",
    group: "featured",
    source: { type: "tmdb-list", path: "/tv/popular", kind: "tv" },
  },
  {
    title: "Top rated series",
    description: "Highest-rated TV series of all time.",
    group: "featured",
    source: { type: "tmdb-list", path: "/tv/top_rated", kind: "tv" },
  },
];

const TITLE_ALIASES: Record<string, string> = {
  "trending this week": "trending-now",
};

const ALL_CATEGORIES: CategoryDef[] = [
  {
    slug: "luganda-translated",
    title: "Luganda Translated",
    description: "Full movies translated into Luganda across every VJ.",
    group: "luganda",
    source: { type: "luganda-all" },
    count: getVjCatalog("all", 0, 1).total,
  },
  ...listVjs().map((v) => ({
    slug: slugifyCategory(v.name),
    title: v.name,
    description: `Luganda translated movies narrated by ${v.name}.`,
    group: "vj" as const,
    source: { type: "vj" as const, vj: v.name },
    count: v.count,
  })),
  ...GENRES.map(([name, genreId]) => ({
    slug: `translated-${slugifyCategory(name)}`,
    title: `Translated ${name}`,
    description: `Luganda translated ${name.toLowerCase()} from our movie catalog.`,
    group: "translated-genre" as const,
    source: { type: "luganda-genre" as const, genreId },
  })),
  ...CURATED_LISTS.map((item) => ({ ...item, slug: slugifyCategory(item.title) })),
  ...GENRES.map(([name, genreId]) => ({
    slug: slugifyCategory(name),
    title: name,
    description: `Browse popular ${name.toLowerCase()} and watch full Luganda translations or trailers.`,
    group: "genre" as const,
    source: { type: "tmdb-genre" as const, genreId },
  })),
];

const bySlug = new Map(ALL_CATEGORIES.map((c) => [c.slug, c]));
const slugByTitle = new Map(ALL_CATEGORIES.map((c) => [c.title.toLowerCase(), c.slug]));

export function getAllCategories(): CategoryDef[] {
  return ALL_CATEGORIES;
}

export function getCategoryBySlug(slug: string): CategoryDef | null {
  return bySlug.get(slug.toLowerCase()) ?? null;
}

export function getCategorySlugByTitle(title: string): string | null {
  const key = title.trim().toLowerCase();
  return slugByTitle.get(key) ?? TITLE_ALIASES[key] ?? null;
}

export function getSuggestedCategories(currentSlug: string, limit = 8): CategoryDef[] {
  const current = getCategoryBySlug(currentSlug);
  const others = ALL_CATEGORIES.filter((c) => c.slug !== currentSlug);
  const luganda = others.filter((c) => c.group === "luganda");
  const vjs = others.filter((c) => c.group === "vj");
  const featured = others.filter((c) => c.group === "featured");
  const translatedGenres = others.filter((c) => c.group === "translated-genre");
  const genres = others.filter((c) => c.group === "genre");

  // Translated collections always come first; untranslated TMDB shelves last.
  const ordered = [...luganda, ...vjs, ...translatedGenres, ...featured, ...genres];
  void current;

  const seen = new Set<string>();
  const out: CategoryDef[] = [];
  for (const cat of [...ordered, ...others]) {
    if (seen.has(cat.slug)) continue;
    seen.add(cat.slug);
    out.push(cat);
    if (out.length >= limit) break;
  }
  return out;
}