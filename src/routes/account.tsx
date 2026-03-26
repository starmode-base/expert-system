import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/account")({
  component: AccountLayout,
});

function AccountLayout() {
  const subNavItems = [
    { key: "api-docs", to: "/account/api-docs", label: "API Docs" },
    { key: "api-keys", to: "/account/api-keys", label: "API Keys" },
  ];

  return (
    <div className="min-h-[calc(100dvh-64px)]">
      <div className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-1.5 overflow-x-auto px-3 py-2 sm:gap-2 sm:px-6">
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
