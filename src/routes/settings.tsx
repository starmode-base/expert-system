import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAuth } from "@clerk/tanstack-start";

const ALLOWED_USER_ID = "user_2ujqJX9ueMg9wBJVUVATq8veKI3";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const auth = useAuth();

  // Redirect unauthorized users
  if (auth.userId !== ALLOWED_USER_ID) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-800">Access Denied</h1>
          <p className="mt-2 text-sm text-red-600">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const subNavItems = [
    { key: "importer", to: "/settings/importer", label: "Importer" },
    { key: "x", to: "/settings/x", label: "X Settings" },
    { key: "knowledge-graph", to: "/settings/knowledge-graph", label: "Knowledge Graph" },
  ];

  return (
    <div className="min-h-[calc(100dvh-64px)]">
      <div className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-6">
          {subNavItems.map((item) => (
            <Link
              key={item.key}
              className="cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              to={item.to}
              activeProps={{
                className:
                  "border-slate-200 bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
              }}
              activeOptions={{ exact: false }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
