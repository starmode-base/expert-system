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
        title: "ΞXPERT-SYSTEM",
      },
      {
        name: "description",
        content: "STΛR MODΞ - Expert-System",
      },
      {
        name: "og:title",
        content: "STΛR MODΞ",
      },
      {
        name: "og:description",
        content: "STΛR MODΞ - Expert-System",
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
              <div className="flex gap-2 p-4">
                <UserButton />
                <Link
                  className="text-grey-500 cursor-pointer rounded-md px-2 hover:bg-gray-100"
                  to="/search"
                  activeProps={{
                    className: "font-bold",
                  }}
                  activeOptions={{ exact: false }}
                >
                  Feed
                </Link>
                <Link
                  className="text-grey-500 cursor-pointer rounded-md px-2 hover:bg-gray-100"
                  to="/insights"
                  activeProps={{
                    className: "font-bold",
                  }}
                  activeOptions={{ exact: false }}
                >
                  Insights
                </Link>
                <Link
                  className="text-grey-500 cursor-pointer rounded-md px-2 hover:bg-gray-100"
                  to="/knowledge-graph"
                  activeProps={{
                    className: "font-bold",
                  }}
                  activeOptions={{ exact: false }}
                >
                  Knowledge Graph
                </Link>

                <Link
                  className="text-grey-500 cursor-pointer rounded-md px-2 hover:bg-gray-100"
                  to="/insight-studio"
                  activeProps={{
                    className: "font-bold",
                  }}
                  activeOptions={{ exact: false }}
                >
                  Insight Studio
                </Link>
                <Link
                  className="text-grey-500 cursor-pointer rounded-md px-2 hover:bg-gray-100"
                  to="/importer"
                  activeProps={{
                    className: "font-bold",
                  }}
                  activeOptions={{ exact: false }}
                >
                  Importer
                </Link>
              </div>
              {props.children}
            </SignedInRouterGate>
          </SignedIn>
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}

function SignedOutRouterGate(props: React.PropsWithChildren) {
  const location = useLocation();

  if (location.pathname !== "/feed/signed-out") {
    return <Navigate to="/feed/signed-out" replace />;
  }

  return props.children;
}

function SignedInRouterGate(props: React.PropsWithChildren) {
  const location = useLocation();

  if (location.pathname === "/feed/signed-out") {
    return <Navigate to="/insights" replace />;
  }

  return props.children;
}
