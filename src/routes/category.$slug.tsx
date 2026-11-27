import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { infiniteQueryOptions, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { CategoryDef } from "@/lib/categories";
import { getCategoryPage } from "@/lib/tmdb.functions";
import { getCategoryBySlug, getSuggestedCategories } from "@/lib/categories";
import { dedupeAppend } from "@/lib/media-browsing";
import { LandscapeCard } from "@/components/LandscapeCard";
import { GridSkeleton, useScrollSentinel } from "@/components/HomeInfiniteGrid";

const categoryQuery = (slug: string) =>
  infiniteQueryOptions({
    queryKey: ["category", slug],
    queryFn: ({ pageParam }) => getCategoryPage({ data: { slug, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last) => last?.nextPage ?? undefined,
    staleTime: 600_000,
  });

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params, context }) => {
    const category = getCategoryBySlug(params.slug);
    if (!category) throw notFound();
    const data = await context.queryClient.ensureInfiniteQueryData(categoryQuery(category.slug));
    const first = data.pages[0];
    if (!first) throw notFound();
    return {
      title: category.title,
      description: category.description,
      coverImage: first.items.find((m) => m.backdrop)?.backdrop ?? null,
    };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — FRESHFLIX` : "Category — FRESHFLIX";
    const description =
      loaderData?.description ?? "Browse movies and TV shows by category on FRESHFLIX.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData?.coverImage
          ? [
              { property: "og:image", content: loaderData.coverImage },
              { name: "twitter:image", content: loaderData.coverImage },
            ]
          : []),
      ],
    };
  },
  component: CategoryPage,
  errorComponent: ({ error }) => (
    <div className="px-4 py-28 text-center text-muted-foreground sm:px-10" role="alert">
      {error instanceof Error ? error.message : "Could not load this category."}
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-4 py-28 text-center sm:px-10">
      <h1 className="font-display text-3xl text-foreground">Category not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Explore another category or head back to the home page.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Back to Home
      </Link>
    </div>
  ),
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const category = getCategoryBySlug(slug);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    categoryQuery(category?.slug ?? slug),
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  const items = useMemo(
    () => dedupeAppend([], data.pages.flatMap((p) => p?.items ?? [])),
    [data],
  );

  const firstPage = data.pages[0];
  const total = firstPage?.total ?? category?.count ?? null;

  useEffect(() => {
    if (!isFetchingNextPage && hasNextPage && items.length < 8) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, items.length]);

  const sentinelRef = useScrollSentinel(Boolean(hasNextPage) && !isFetchingNextPage, () => {
    void fetchNextPage();
  });

  const suggestions = useMemo(
    () => getSuggestedCategories(category?.slug ?? slug, 200),
    [category?.slug, slug],
  );

  if (!category) return null;

  return (
    <div className="px-4 pb-20 pt-24 sm:px-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <header className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl text-foreground sm:text-5xl">{category.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{category.description}</p>
        </div>
        {total !== null && (
          <p className="text-xs font-medium text-muted-foreground">
            {total.toLocaleString()} titles
          </p>
        )}
      </header>

      <section className="mt-8" aria-label={`${category.title} titles`}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <LandscapeCard key={`${m.kind}-${m.id}`} m={m} grid />
          ))}
          {isFetchingNextPage && <GridSkeleton count={4} />}
        </div>
        <div ref={sentinelRef} className="h-10" aria-hidden="true" />
      </section>

      {!hasNextPage && !isFetchingNextPage && (
        <ContinuationFeed key={category.slug} categories={suggestions} />
      )}
    </div>
  );
}
/** After a category ends, keep scrolling into the next categories (translated first). */
function ContinuationFeed({ categories }: { categories: CategoryDef[] }) {
  const [visible, setVisible] = useState(1);
  return (
    <>
      {categories.slice(0, visible).map((cat, i) => (
        <ContinuationSection
          key={cat.slug}
          category={cat}
          active={i === visible - 1}
          onDone={() => setVisible((v) => Math.max(v, i + 2))}
        />
      ))}
    </>
  );
}

function ContinuationSection({
  category,
  active,
  onDone,
}: {
  category: CategoryDef;
  active: boolean;
  onDone: () => void;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError } =
    useInfiniteQuery(categoryQuery(category.slug));
  const items = useMemo(
    () => dedupeAppend([], data?.pages.flatMap((p) => p?.items ?? []) ?? []),
    [data],
  );
  const finished = isError || (!isPending && !hasNextPage && !isFetchingNextPage);
  useEffect(() => {
    if (active && finished) onDone();
  }, [active, finished, onDone]);
  const sentinelRef = useScrollSentinel(
    active && Boolean(hasNextPage) && !isFetchingNextPage,
    () => void fetchNextPage(),
  );
  if (!isPending && items.length === 0) return null;
  return (
    <section className="mt-12 border-t border-border pt-8" aria-label={`${category.title} titles`}>
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <h2 className="truncate font-display text-2xl text-foreground">{category.title}</h2>
        <Link
          to="/category/$slug"
          params={{ slug: category.slug }}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary"
        >
          Open <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
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
