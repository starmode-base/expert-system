import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account/usage")({
  component: UsagePage,
});

function UsagePage() {
  return (
    <div className="mx-auto max-w-4xl px-3 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">API Usage</h1>
      <p className="mt-2 text-sm text-slate-500">
        Usage metrics and analytics coming soon.
      </p>
    </div>
  );
}
