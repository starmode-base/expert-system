import { createFileRoute } from "@tanstack/react-router";

/**
 * Route
 */
export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="justify-center_ items-center_ flex h-[calc(100dvh-64px)] flex-col gap-8 bg-slate-100 p-8">
      <img
        src="/starmode-logo.svg"
        alt="STΛR MODΞ logo"
        className="mx-auto max-w-sm"
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-10">
        <div className="max-w-4xl text-center text-5xl text-slate-800 sm:text-8xl">
          ΞXPERT-SYSTΞM
        </div>
        <small className="block text-2xl font-extralight tracking-[0.15em]">
          Augmented Reasoning Engine
        </small>
      </div>
    </div>
  );
}
