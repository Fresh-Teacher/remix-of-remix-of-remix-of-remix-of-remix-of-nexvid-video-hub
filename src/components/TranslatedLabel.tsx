export function TranslatedLabel({ translated }: { translated: boolean }) {
  if (!translated) return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold leading-tight text-primary">
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="truncate">Translated</span>
    </p>
  );
}

export function VjThumbnailPill({ vj }: { vj: string | null }) {
  if (!vj) return null;
  return <span className="vj-pill truncate">{vj}</span>;
}
