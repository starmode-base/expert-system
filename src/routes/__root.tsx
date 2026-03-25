import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  redirect,
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
  useUser,
  UserButton,
} from "@clerk/tanstack-start";
import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "vinxi/http";
import { getClerkUserId } from "~/server/auth";
import { getSiteOrigin } from "~/lib/env";

const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const clerkUserId = await getClerkUserId(getWebRequest());
  return !!clerkUserId;
});

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
  beforeLoad: async ({ location }) => {
    const isAuthenticated = await checkAuth();

    // Paths accessible without authentication
    const isPublicPath =
      location.pathname === "/" ||
      location.pathname.startsWith("/research-feed") ||
      location.pathname.startsWith("/takeaway-feed") ||
      location.pathname.startsWith("/news-feed") ||
      location.pathname.startsWith("/insight/");

    if (!isAuthenticated && !isPublicPath) {
      throw redirect({
        to: "/takeaway-feed",
        search: { searchInput: undefined, filters: undefined },
      });
    }
  },
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
  const { user } = useUser();
  const researchLabel = user?.firstName
    ? `${user.firstName}'s Research`
    : "Research";
  const publicNavItems = [
    { key: "takeaways", to: "/takeaway-feed", label: "Takeaways" },
    { key: "news-feed", to: "/news-feed", label: "News" },
    { key: "research", to: "/research-feed", label: researchLabel },
    { key: "api", to: "/account/api-keys", label: "API" },
  ];

  const devNavItems = [
    { key: "research", to: "/research-feed", label: researchLabel },
    { key: "insight-studio", to: "/insight-studio", label: "Insight Studio" },
    { key: "settings", to: "/settings", label: "Settings" },
  ];

  const unauthNavItems = [
    { key: "research", to: "/research-feed", label: researchLabel },
    { key: "takeaways", to: "/takeaway-feed", label: "Takeaways" },
    { key: "news-feed", to: "/news-feed", label: "News" },
  ];

  // TODO: add user role for dev permissions.
  const navItems: { key: string; to: string; label: string }[] =
    !auth.isSignedIn
      ? unauthNavItems
      : auth.userId === "user_2ujqJX9ueMg9wBJVUVATq8veKI3"
        ? publicNavItems.concat(devNavItems)
        : publicNavItems;

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-slate-200/60 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex h-full max-w-4xl items-center gap-3 px-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/takeaway-feed"
            search={{ searchInput: undefined, filters: undefined }}
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
