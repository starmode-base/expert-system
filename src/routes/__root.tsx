import {
  HeadContent,
  Link,
  Navigate,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
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
  useAuth,
  UserButton,
} from "@clerk/tanstack-start";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "ΞXPERT-SYSTΞM",
      },
      {
        name: "description",
        content: "STΛR MODΞ - ΞXPERT-SYSTΞM",
      },
      {
        name: "og:title",
        content: "STΛR MODΞ",
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
  }),
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
          <SignedOut>
            <SignedOutRouterGate>{props.children}</SignedOutRouterGate>
          </SignedOut>
          <SignedIn>
            <SignedInRouterGate>
              <div className="min-h-dvh bg-slate-100">
                <NavBar />
                {props.children}
              </div>
            </SignedInRouterGate>
          </SignedIn>
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}

function NavBar() {
  const auth = useAuth();
  const publicNavItems = [
    { key: "research", to: "/research-feed", label: "Research" },
    { key: "takeaways", to: "/search", label: "Takeaways" },
  ];

  const devNavItems = [
    { key: "insight-studio", to: "/insight-studio", label: "Insight Studio" },
    {
      key: "knowledge-graph",
      to: "/knowledge-graph",
      label: "Knowledge Graph",
    },
    { key: "importer", to: "/importer", label: "Importer" },
  ];

  // TODO: add user role for dev permissions.
  const navItems: { key: string; to: string; label: string }[] =
    auth.userId === "user_2ujqJX9ueMg9wBJVUVATq8veKI3"
      ? publicNavItems.concat(devNavItems)
      : publicNavItems;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex max-w-4xl items-center gap-3 px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/research-feed"
            className="group inline-flex flex-col items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100"
          >
            <img
              src="/starmode-logo.svg"
              alt="STΛR MODΞ"
              className="hidden h-4 w-auto opacity-80 sm:inline"
            />
            <span className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
              ΞXPERT-SYSTΞM
            </span>
          </Link>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex w-max items-center gap-1.5 sm:gap-2">
            {navItems.map((item) => (
              <Link
                key={item.key}
                className="cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
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
          </div>
        </div>

        <div className="shrink-0">
          <UserButton />
        </div>
      </nav>
    </header>
  );
}

// TODO: These gates are slow and inelegant solutions. Ask Mikael how to improve this.

function SignedOutRouterGate(props: React.PropsWithChildren) {
  const location = useLocation();

  if (
    !(
      location.pathname.startsWith("/guest/research-feed") ||
      location.pathname.startsWith("/insight/")
    )
  ) {
    return <Navigate to="/guest/research-feed" />;
  }

  return props.children;
}

function SignedInRouterGate(props: React.PropsWithChildren) {
  const location = useLocation();

  if (location.pathname === "/guest/research-feed") {
    return <Navigate to="/research-feed" replace />;
  }

  return props.children;
}
