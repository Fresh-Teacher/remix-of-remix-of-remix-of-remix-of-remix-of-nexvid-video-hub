import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Film, Play, Star } from "lucide-react";
import type { MediaDetail } from "@/lib/tmdb.functions";
import { Button } from "@/components/ui/button";
import { LandscapeCard, LandscapeRow } from "./LandscapeCard";
import { detailRows, type MediaRow } from "@/lib/media-browsing";
import { findLugandaStreams } from "@/lib/luganda-movies";
import { whatsappRequestUrl } from "@/config/contact";

export function DetailPage({ d, rows }: { d: MediaDetail; rows: MediaRow[] }) {
  const ownVj = d.kind === "movie" ? (findLugandaStreams(d.title, d.year)[0]?.vj ?? null) : null;
  const recommendations = detailRows(d, rows, ownVj && ownVj !== "Luganda Translated" ? ownVj : ownVj ? "Luganda Translated" : null);
  const [similar, ...others] = recommendations;
  return (
    <div className="pb-20 pt-16">
      <div className="mx-auto max-w-6xl sm:px-10 sm:pt-6">
        <Player key={`${d.kind}-${d.id}`} d={d} />
      </div>
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-10">
        <p className="text-xs font-semibold uppercase text-primary">
          {d.kind === "tv" ? "Series" : "Film"}
        </p>
        <h1 className="mt-2 break-words font-display text-3xl leading-tight text-foreground sm:text-5xl">
          {d.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1 text-foreground">
            <Star className="h-4 w-4 fill-primary text-primary" />
            {d.rating} / 10
          </span>
          {d.year && <span>{d.year}</span>}
          {d.runtime && <span>{d.runtime}</span>}
        </div>
        {d.tagline && <p className="mt-4 italic text-muted-foreground">{d.tagline}</p>}
        <p className="mt-4 max-w-3xl leading-relaxed text-foreground/85">{d.overview}</p>
        {d.genres.length > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Genres: <span className="text-foreground/85">{d.genres.join(", ")}</span>
          </p>
        )}
      </section>
      {d.cast.length > 0 && (
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-10">
          <h2 className="mb-4 font-display text-xl text-foreground">Cast</h2>
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
            {d.cast.map((c) => (
              <div key={c.name + c.character} className="w-24 shrink-0 text-center">
                <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-muted">
                  {c.photo && (
                    <img
                      src={c.photo}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-foreground">{c.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{c.character}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {similar && (
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-10">
          <h2 className="mb-4 font-display text-xl text-foreground">{similar.title}</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
            {similar.items.map((m) => (
              <LandscapeCard key={`${m.kind}-${m.id}`} m={m} grid />
            ))}
          </div>
        </section>
      )}
      {others.map((r) => (
          <LandscapeRow key={r.title} title={r.title} items={r.items} />
        ))}
    </div>
  );
}

function Player({ d }: { d: MediaDetail }) {
  const [mode, setMode] = useState<"idle" | "trailer" | "movie">("idle");
  const [streamIndex, setStreamIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const img = d.backdrop ?? d.poster;
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
  }, [img]);
  const streams = d.kind === "movie" ? findLugandaStreams(d.title, d.year) : [];
  const activeStream = streams[streamIndex] ?? streams[0] ?? null;
  const showMovie = mode === "movie" && Boolean(activeStream);
  const showTrailer = mode === "trailer" && Boolean(d.trailerKey);
  return (
    <div>
      <div
        className={`relative aspect-video w-full overflow-hidden bg-muted sm:rounded-lg ${img && !loaded && !showMovie && !showTrailer ? "img-shimmer" : ""}`}
      >
        {showMovie && activeStream ? (
          <video
            key={activeStream.href}
            className="h-full w-full bg-background object-contain"
            src={activeStream.href}
            poster={img ?? undefined}
            title={`${d.title} (${activeStream.vj})`}
            controls
            autoPlay
            playsInline
          />
        ) : showTrailer ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${d.trailerKey}?autoplay=1&controls=1&playsinline=1&rel=0`}
            title={`${d.title} trailer`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {img && (
              <img
                ref={imgRef}
                src={img}
                alt={d.title}
                decoding="async"
                onLoad={() => setLoaded(true)}
                className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-background/90 via-background/25 to-transparent p-4 text-center">
              {mode !== "idle" && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-sm text-foreground"
                >
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  {mode === "movie" ? "The movie is not yet available." : "The trailer is not yet available."}
                </p>
              )}
              {mode !== "idle" && (
                <Button asChild variant="link" className="h-auto bg-background/90 px-3 py-1">
                  <a href={whatsappRequestUrl(mode, d.title)} target="_blank" rel="noopener noreferrer">
                    {mode === "movie" ? "Request Movie" : "Request Trailer"}
                  </a>
                </Button>
              )}
              {activeStream && (
                <span className="rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground">
                  Luganda • {activeStream.vj}
                </span>
              )}
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => setMode("movie")}>
                  <Play className="fill-current" />
                  Play Movie
                </Button>
                <Button variant="secondary" onClick={() => setMode("trailer")}>
                  <Film />
                  Watch Trailer
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      {(showMovie || showTrailer) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-0">
          <div className="flex flex-wrap items-center gap-2">
            {streams.length > 1 &&
              streams.map((s, idx) => (
                <Button
                  key={s.href}
                  size="sm"
                  variant={showMovie && idx === streamIndex ? "default" : "secondary"}
                  onClick={() => {
                    setStreamIndex(idx);
                    setMode("movie");
                  }}
                >
                  {s.vj}
                </Button>
              ))}
            {streams.length === 1 && activeStream && (
              <span className="text-xs font-medium text-muted-foreground">
                Luganda • {activeStream.vj}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showTrailer && activeStream && (
              <Button size="sm" onClick={() => setMode("movie")}>
                <Play className="fill-current" />
                Play Movie
              </Button>
            )}
            {showMovie && d.trailerKey && (
              <Button size="sm" variant="secondary" onClick={() => setMode("trailer")}>
                <Film />
                Watch Trailer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
