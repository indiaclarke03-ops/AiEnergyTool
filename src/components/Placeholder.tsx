export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-stone-500">Coming in milestone {milestone}.</p>
    </div>
  );
}
