export function FullScreenLoader() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-screen place-items-center">
      <span className="size-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
    </div>
  );
}
