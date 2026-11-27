import { describe, expect, it } from "vitest";
import { dedupeAppend, detailRows, featuredSlides, uniqueRows } from "@/lib/media-browsing";
import {
  getFeaturedLugandaCatalog,
  getLugandaBadgeLabel,
  getLugandaCardInfo,
  getVjCatalog,
  listVjs,
} from "@/lib/luganda-movies";
import {
  getCategoryBySlug,
  getCategorySlugByTitle,
  getSuggestedCategories,
} from "@/lib/categories";
import type { MediaCardData } from "@/lib/tmdb.functions";

const movie = (id: number, kind: "movie" | "tv" = "movie"): MediaCardData => ({
  id,
  kind,
  title: `Title ${id}`,
  poster: null,
  backdrop: null,
  year: "2026",
  rating: 7,
  overview: "",
});

describe("Browsing variety", () => {
  it("shows each movie only once across homepage categories, excluding the featured movie", () => {
    const rows = uniqueRows(
      [
        { title: "Trending", items: [movie(1), movie(2), movie(2)] },
        { title: "Popular", items: [movie(1), movie(2), movie(3)] },
        { title: "Action", items: [movie(2), movie(3), movie(4)] },
      ],
      [movie(1)],
    );
    expect(rows.map((r) => r.items.map((m) => m.id))).toEqual([[2], [3], [4]]);
  });
  it("keeps a movie and series with the same numeric ID", () => {
    expect(
      uniqueRows([{ title: "Trending", items: [movie(1), movie(1, "tv")] }])[0]?.items,
    ).toHaveLength(2);
  });
  it("puts the movie's own category first, then translated shelves, then TMDB shelves", () => {
    const rows = detailRows({ ...movie(1), similar: [movie(9)] }, [
      { title: "Trending now", items: [movie(2), movie(3)] },
      { title: "VJ Emmy", items: [movie(1), movie(4)] },
      { title: "VJ Junior", items: [movie(5)] },
      { title: "Translated Action Movies", items: [movie(6)] },
    ], "VJ Junior");
    expect(rows.map((r) => r.title)).toEqual([
      "More from VJ Junior",
      "VJ Emmy",
      "Translated Action Movies",
      "Trending now",
    ]);
  });
  it("starts with similar titles for an untranslated movie but still lists translated shelves before TMDB", () => {
    const rows = detailRows({ ...movie(1), similar: [movie(9)] }, [
      { title: "Popular movies", items: [movie(2)] },
      { title: "Luganda Translated", items: [movie(3)] },
    ]);
    expect(rows.map((r) => r.title)).toEqual(["More like this", "Luganda Translated", "Popular movies"]);
  });
  it("features only translated movies with backdrops in the jumbotron", () => {
    const rows = [
      { title: "Trending now", items: [{ ...movie(1), backdrop: "/1.jpg" }] },
      { title: "Luganda Translated", items: [movie(2), { ...movie(3), backdrop: "/3.jpg" }] },
      { title: "VJ Emmy", items: [{ ...movie(3), backdrop: "/3.jpg" }, { ...movie(4), backdrop: "/4.jpg" }] },
    ];
    expect(featuredSlides(rows).map((item) => item.id)).toEqual([3, 4]);
  });
  it("lists translated categories before TMDB categories in suggestions", () => {
    const groups = getSuggestedCategories("action-movies", 200).map((c) => c.group);
    const lastTranslated = Math.max(...groups.map((g, i) => (["luganda", "vj", "translated-genre"].includes(g) ? i : -1)));
    const firstTmdb = groups.findIndex((g) => g === "featured" || g === "genre");
    expect(lastTranslated).toBeLessThan(firstTmdb);
  });
  it("never repeats already-displayed movies when appending infinite scroll batches", () => {
    const alreadyShown = [movie(1), movie(2), movie(3, "tv")];
    const incoming = [movie(2), movie(4), movie(4), movie(3), movie(3, "tv"), movie(5)];
    expect(dedupeAppend(alreadyShown, incoming).map((m) => `${m.kind}-${m.id}`)).toEqual([
      "movie-4",
      "movie-3",
      "movie-5",
    ]);
  });
});

describe("Luganda catalog badges and VJ categories", () => {
  it("formats Translated badge with VJ name when known and plain Translated when generic", () => {
    expect(getLugandaBadgeLabel("Dr. Dolittle 2", "2001")).toBe("Translated · VJ Emmy");
    expect(getLugandaBadgeLabel("Sample Untranslated Movie", "2026")).toBeNull();
    expect(getLugandaBadgeLabel("Unknown Film", "2026", "Luganda Translated")).toBe("Translated");
    expect(getLugandaBadgeLabel("Evil Dead Rise", "2023", "VJ Emmy")).toBe("Translated · VJ Emmy");
  });
  it("lists named VJs sorted by movie count and filters strictly by VJ", () => {
    const vjs = listVjs();
    expect(vjs[0]?.name).toBe("VJ Junior");
    expect(vjs[0]?.count ?? 0).toBeGreaterThan(500);
    const emmy = getVjCatalog("VJ Emmy", 0, 10);
    expect(emmy.items).toHaveLength(10);
    expect(emmy.items.every((m) => m.vj === "VJ Emmy")).toBe(true);
    expect(emmy.hasMore).toBe(true);
  });
  it("interleaves multiple VJs in the featured Luganda Translated shelf", () => {
    const featured = getFeaturedLugandaCatalog(12);
    const distinctVjs = new Set(featured.map((m) => m.vj));
    expect(featured).toHaveLength(12);
    expect(distinctVjs.size).toBeGreaterThanOrEqual(4);
  });
  it("splits card metadata into translated flag and VJ pill text", () => {
    expect(getLugandaCardInfo("Dr. Dolittle 2", "2001")).toEqual({
      translated: true,
      vj: "VJ Emmy",
    });
    expect(getLugandaCardInfo("Unknown Film", "2026", "Luganda Translated")).toEqual({
      translated: true,
      vj: null,
    });
    expect(getLugandaCardInfo("Sample Untranslated Movie", "2026")).toEqual({
      translated: false,
      vj: null,
    });
  });
  it("resolves category slugs and suggests alternative categories without repeating the current one", () => {
    expect(getCategorySlugByTitle("Luganda Translated")).toBe("luganda-translated");
    expect(getCategorySlugByTitle("VJ Junior")).toBe("vj-junior");
    expect(getCategorySlugByTitle("Action Movies")).toBe("action-movies");
    expect(getCategorySlugByTitle("More like this")).toBeNull();
    expect(getCategoryBySlug("action-movies")?.title).toBe("Untranslated Action Movies");
    const suggestions = getSuggestedCategories("vj-mark", 8);
    expect(suggestions).toHaveLength(8);
    expect(suggestions.every((c) => c.slug !== "vj-mark")).toBe(true);
    expect(new Set(suggestions.map((c) => c.slug)).size).toBe(8);
  });
});
