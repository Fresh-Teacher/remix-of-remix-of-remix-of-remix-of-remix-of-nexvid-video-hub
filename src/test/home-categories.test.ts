import { describe, expect, it } from "vitest";
import rawMovies from "@/data/luganda-movies.json";
import { catalogKey, getVjCatalog, listVjs } from "@/lib/luganda-movies";
import { GENRES, getAllCategories, getCategoryBySlug } from "@/lib/categories";
import { homeRows } from "@/lib/media-browsing";
import type { MediaCardData } from "@/lib/tmdb.functions";

describe("Expanded home categories", () => {
  it("counts all translated movies uniquely including movies without a named VJ", () => {
    const unique = new Set(rawMovies.map(catalogKey));
    expect(getCategoryBySlug("luganda-translated")?.count).toBe(unique.size);
    expect(getVjCatalog("all", 0, 1).total).toBe(unique.size);
  });
  it("includes every named VJ, even VJs with one translated movie", () => {
    const names = [...new Set(rawMovies.map((m) => m.vj))].filter((name) => name !== "Luganda Translated").sort();
    expect(listVjs().map((vj) => vj.name).sort()).toEqual(names);
    expect(listVjs().find((vj) => vj.name === "VJ Shao")?.count).toBe(1);
    expect(getAllCategories().filter((c) => c.group === "vj").map((c) => c.title).sort()).toEqual(names);
  });
  it("puts every translated genre after VJs and before TMDB lists and genres", () => {
    const categories = getAllCategories();
    const translated = categories.filter((c) => c.source.type === "luganda-genre");
    expect(translated.map((c) => c.source.type === "luganda-genre" ? c.source.genreId : null)).toEqual(GENRES.map(([, id]) => id));
    expect(categories.findIndex((c) => c.group === "translated-genre")).toBe(1 + listVjs().length);
    expect(categories.findIndex((c) => c.group === "featured")).toBe(1 + listVjs().length + GENRES.length);
    expect(getCategoryBySlug("translated-action-movies")?.source).toEqual({ type: "luganda-genre", genreId: 28 });
    expect(["coming-soon", "trending-now", "now-playing-in-cinemas", "popular-movies", "top-rated-films"].every((slug) => getCategoryBySlug(slug)?.source.type === "tmdb-list")).toBe(true);
  });
  it("does not erase a small VJ or genre shelf when another collection shares its movie", () => {
    const card: MediaCardData = { id: 1, kind: "movie", title: "Shared", poster: null, backdrop: null, year: "2026", rating: 7, overview: "" };
    const rows = homeRows([
      { title: "Luganda Translated", items: [card, card] },
      { title: "VJ Shao", items: [card, card] },
      { title: "Translated Action Movies", items: [card, card] },
      { title: "Coming soon", items: [card, card] },
    ]);
    expect(rows.map((row) => row.items.length)).toEqual([1, 1, 1, 1]);
  });
});