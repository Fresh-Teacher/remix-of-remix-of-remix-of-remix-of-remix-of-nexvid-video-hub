import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      inputValidator: () => builder,
      handler: (handler: (input: unknown) => unknown) => handler,
    };
    return builder;
  },
}));

describe("Translated genre paging", () => {
  beforeAll(() => {
    vi.stubEnv("TMDB_API_KEY", "test-key");
    let id = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      const current = ++id;
      const year = url.searchParams.get("year") ?? "2026";
      return {
        ok: true,
        json: async () => ({ results: [{
          id: current,
          title: url.searchParams.get("query"),
          release_date: `${year}-01-01`,
          genre_ids: current % 2 === 0 ? [28] : [35],
          backdrop_path: "/test.jpg",
        }] }),
      };
    }));
  });

  it("filters catalog translations by TMDB genre rather than mixing in the general genre feed", async () => {
    const { getCategoryPage } = await import("@/lib/tmdb.functions");
    const page = await getCategoryPage({ data: { slug: "translated-action-movies", page: 1 } });
    expect(page?.items).toHaveLength(12);
    expect(page?.items.every((movie) => movie.genreIds?.includes(28) && Boolean(movie.lugandaVj))).toBe(true);
    expect(page?.items.some((movie) => movie.genreIds?.includes(35))).toBe(false);
  });

  it("paginates translated genres in disjoint batches with an accurate total", async () => {
    const { getCategoryPage } = await import("@/lib/tmdb.functions");
    const first = await getCategoryPage({ data: { slug: "translated-action-movies", page: 1 } });
    const second = await getCategoryPage({ data: { slug: "translated-action-movies", page: 2 } });
    expect(first?.nextPage).toBe(2);
    expect(second?.items).toHaveLength(12);
    expect(second?.total).toBe(first?.total);
    const firstIds = new Set(first?.items.map((movie) => movie.id));
    expect(second?.items.some((movie) => firstIds.has(movie.id))).toBe(false);
    const lastPage = Math.ceil((first?.total ?? 0) / 12);
    const last = await getCategoryPage({ data: { slug: "translated-action-movies", page: lastPage } });
    expect(last?.nextPage).toBeNull();
  });
});