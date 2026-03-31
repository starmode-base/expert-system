import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/default-catch-boundary";
import { NotFound } from "~/components/not-found";
import appCss from "~/styles/app.css?url";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
  UserButton,
} from "@clerk/tanstack-start";
import { getSiteOrigin } from "~/lib/env";

const head = {
  meta: [
    {
      charSet: "utf-8",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1",
    },
    { title: "ΞXPERT-SYSTΞM" },
    {
      name: "og:title",
      content: "ΞXPERT-SYSTΞM",
    },
    { name: "og:image", content: `${getSiteOrigin()}/logo-x.jpg` },
    {
      name: "description",
      content: "STΛR MODΞ - ΞXPERT-SYSTΞM",
    },

    {
      name: "og:description",
      content: "STΛR MODΞ - ΞXPERT-SYSTΞM",
    },
  ],
  links: [
    {
      rel: "stylesheet",
      href: appCss,
    },
    {
      rel: "icon",
      href: "/icon.svg",
    },
  ],
};

export const Route = createRootRoute({
  head: () => head,
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument(props: React.PropsWithChildren) {
  return (
    <ClerkProvider>
      <html>
        <head>
          <HeadContent />
        </head>
        <body>
          <div className="min-h-dvh bg-slate-100">
            <NavBar />
            {props.children}
          </div>
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}

function NavBar() {
  const auth = useAuth();

  // TODO: add user role for dev permissions.
  const devNavItems = [
    { key: "insight-studio", to: "/insight-studio", label: "Insight Studio" },
    { key: "settings", to: "/settings", label: "Settings" },
  ];

  const isDev = auth.userId === "user_2ujqJX9ueMg9wBJVUVATq8veKI3";

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-slate-200/60 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex h-full max-w-4xl items-center gap-3 px-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="mx-auto flex w-max items-center gap-1.5 sm:gap-2">
            <Link
              key="about"
              className="cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              to="/"
              activeProps={{
                className:
                  "border-slate-200 bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
              }}
              activeOptions={{ exact: true }}
            >
              About
            </Link>
            <Link
              key="api"
              className="cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              to="/account/api-docs"
              activeProps={{
                className:
                  "border-slate-200 bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
              }}
              activeOptions={{ exact: false }}
            >
              API
            </Link>
            <Link
              key="feeds"
              className="cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              to="/feeds/insights"
              search={{ searchInput: undefined, filters: undefined }}
              activeProps={{
                className:
                  "border-slate-200 bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
              }}
              activeOptions={{ exact: false }}
            >
              Feeds
            </Link>
            <Link
              key="pricing"
              className="cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              to="/pricing"
              activeProps={{
                className:
                  "border-slate-200 bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
              }}
              activeOptions={{ exact: true }}
            >
              Pricing
            </Link>
            {isDev
              ? devNavItems.map((item) => (
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
                ))
              : null}
          </div>
        </div>

        <div className="shrink-0">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </nav>
    </header>
  );
}
