export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24" role="status" aria-live="polite">
      <span className="dk-spinner" />
      <p className="text-sm" style={{ color: "#6b7f8a" }}>Načítám…</p>
    </div>
  );
}
