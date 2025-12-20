export function NotFound() {
  return (
    <main className="flex h-full w-full items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-xl flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <img src="/starmode-logo.svg" alt="STΛR MODΞ" className="h-9 w-auto" />

        <div className="mt-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Page not found
          </h1>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            404
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Check the URL for typos, or use one of the links below to get back on
          track
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => {
              window.history.back();
            }}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Go back
          </button>
        </div>
      </div>
    </main>
  );
}
