import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Film } from "lucide-react";
import type { MediaCardData } from "@/lib/tmdb.functions";
import { getLugandaCardInfo } from "@/lib/luganda-movies";
import { getCategorySlugByTitle } from "@/lib/categories";
import { TranslatedLabel, VjThumbnailPill } from "@/components/TranslatedLabel";

export function LandscapeCard({ m, grid = false }: { m: MediaCardData; grid?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const src = m.backdrop ?? m.poster;
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
  }, [src]);
  const luganda =
    m.kind === "movie"
      ? getLugandaCardInfo(m.title, m.year, m.lugandaVj)
      : { translated: false, vj: null };
  const inner = (
    <>
      <div className={`poster-frame aspect-video ${src && !failed && !loaded ? "img-shimmer" : ""}`}>
        {src && !failed ? (
          <img ref={imgRef} src={src} alt={m.title} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
            <Film className="h-6 w-6 text-muted-foreground" />
            <span className="line-clamp-2 text-sm font-semibold text-foreground">{m.title}</span>
          </div>
        )}
        <VjThumbnailPill vj={luganda.vj} />
      </div>
      <p className={`mt-2 px-0.5 text-sm font-semibold text-foreground ${grid ? "line-clamp-2" : "truncate"}`}>{m.title}</p>
      <TranslatedLabel translated={luganda.translated} />
    </>
  );
  const cls = grid ? "group block min-w-0 w-full" : "landscape-card group block shrink-0 sm:w-72";
  return m.kind === "tv" ? (
    <Link to="/tv/$id" params={{ id: String(m.id) }} className={cls}>{inner}</Link>
  ) : (
    <Link to="/movie/$id" params={{ id: String(m.id) }} className={cls}>{inner}</Link>
  );
}

export function LandscapeRow({ title, items }: { title: string; items: MediaCardData[] }) {
  if (!items.length) return null;
  const slug = getCategorySlugByTitle(title);
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-4 font-display text-xl text-foreground sm:px-10">
        {slug ? (
          <Link
            to="/category/$slug"
            params={{ slug }}
            className="group/row inline-flex items-center gap-1 transition-colors hover:text-primary"
          >
            {title}
            <ChevronRight className="h-5 w-5 text-primary transition-transform group-hover/row:translate-x-0.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1">{title}</span>
        )}
      </h2>
      <div className="landscape-row no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 sm:gap-3 sm:px-10">
        {items.map((m) => <LandscapeCard key={`${m.kind}-${m.id}`} m={m} />)}
      </div>
    </section>
  );
}
