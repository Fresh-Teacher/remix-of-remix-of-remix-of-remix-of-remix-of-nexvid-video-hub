import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getExplorePage, type MediaCardData } from "@/lib/tmdb.functions";
import { dedupeAppend } from "@/lib/media-browsing";
import type { VjSummary } from "@/lib/luganda-movies";
import { getCategoryBySlug, slugifyCategory } from "@/lib/categories";
import { LandscapeCard } from "./LandscapeCard";

export function VjFilterBar({ vjs }: { vjs: VjSummary[] }) {
  if (!vjs.length) return null;
  return (
    <section className="mt-8" aria-label="Browse by VJ">
      <h2 className="mb-3 px-4 font-display text-xl text-foreground sm:px-10">Browse by VJ</h2>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:px-10">
        <Link
          to="/category/$slug"
          params={{ slug: "luganda-translated" }}
          className="shrink-0 rounded-full border border-primary bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          All Translated <span>({getCategoryBySlug("luganda-translated")?.count ?? 0})</span>
        </Link>
        {vjs.map((vj) => (
          <Link
            key={vj.name}
            to="/category/$slug"
            params={{ slug: slugifyCategory(vj.name) }}
            className="shrink-0 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-secondary"
          >
            {vj.name} <span className="text-muted-foreground">({vj.count})</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function useScrollSentinel(enabled: boolean, onReach: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReach();
      },
      { rootMargin: "600px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, onReach]);
  return ref;
}

export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="min-w-0">
          <div className="poster-frame img-shimmer aspect-video" />
          <div className="img-shimmer mt-2 h-4 w-3/4 rounded" />
        </div>
      ))}
    </>
  );
}

export function ExploreMoreGrid({
  displayed,
}: {
  displayed: Pick<MediaCardData, "id" | "kind">[];
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery({
    queryKey: ["explore-more"],
    queryFn: ({ pageParam }) => getExplorePage({ data: { page: pageParam } }),
    initialPageParam: 2,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    staleTime: 600_000,
  });

  const items = useMemo(() => {
    const raw = data?.pages.flatMap((p) => p.items) ?? [];
    return dedupeAppend(displayed, raw);
  }, [data, displayed]);

  useEffect(() => {
    if (!isPending && !isFetchingNextPage && hasNextPage && items.length < 8) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isPending, items.length]);

  const sentinelRef = useScrollSentinel(Boolean(hasNextPage) && !isFetchingNextPage, () => {
    void fetchNextPage();
  });

  return (
    <section className="mt-10 px-4 sm:px-10" aria-label="More movies to explore">
      <h2 className="mb-4 font-display text-xl text-foreground">More to explore</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((m) => (
          <LandscapeCard key={`${m.kind}-${m.id}`} m={m} grid />
        ))}
        {(isPending || isFetchingNextPage) && <GridSkeleton count={4} />}
      </div>
      <div ref={sentinelRef} className="h-10" aria-hidden="true" />
    </section>
  );
}