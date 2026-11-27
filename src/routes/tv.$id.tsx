import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDetail } from "@/lib/tmdb.functions";
import { DetailPage } from "@/components/DetailPage";
import { homeQuery } from "@/lib/home-query";

const q = (id: string) =>
  queryOptions({
    queryKey: ["tv", id],
    queryFn: () => getDetail({ data: { kind: "tv", id: Number(id) } }),
  });

export const Route = createFileRoute("/tv/$id")({
  loader: async ({ context, params }) => {
    const [detail] = await Promise.all([
      context.queryClient.ensureQueryData(q(params.id)),
      context.queryClient.ensureQueryData(homeQuery),
    ]);
    return detail;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.title} — FRESHFLIX` : "FRESHFLIX";
    const desc = loaderData?.overview.slice(0, 155) ?? "Details, cast and trailer on FRESHFLIX.";
    const meta = [
      { title: t },
      { name: "description", content: desc },
      { property: "og:title", content: t },
      { property: "og:description", content: desc },
      { property: "og:type", content: "video.tv_show" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (loaderData?.backdrop)
      meta.push(
        { property: "og:image", content: loaderData.backdrop },
        { name: "twitter:image", content: loaderData.backdrop },
      );
    return { meta };
  },
  component: Page,
  errorComponent: () => (
    <div className="p-24 text-center text-muted-foreground">
      It's not yet available. Try again later.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-24 text-center text-muted-foreground">
      It's not yet available. Try again later.
    </div>
  ),
});

function Page() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(q(id));
  const { data: home } = useSuspenseQuery(homeQuery);
  return <DetailPage d={data} rows={home.rows} />;
}
