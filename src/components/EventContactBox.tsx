export function EventContactBox({ details }: { details: string }) {
  return (
    <div className="card mt-8 p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold-ink)]">Host contact</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{details}</p>
    </div>
  );
}
