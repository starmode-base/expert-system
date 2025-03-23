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
  SignUpButton,
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
        title: "STΛR MODΞ 🦨",
      },
      {
        name: "description",
        content: "STΛR MODΞ skunkworks project",
      },
      {
        name: "og:title",
        content: "STΛR MODΞ 🦨",
      },
      {
        name: "og:description",
        content: "STΛR MODΞ skunkworks project",
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
            <div className="justify-center_ items-center_ flex h-dvh flex-col gap-8 bg-slate-100 p-8">
              <img
                src="/starmode-logo.svg"
                alt="STΛR MODΞ logo"
                className="mx-auto max-w-sm"
              />
              <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-10">
                <div className="max-w-4xl text-center text-5xl font-semibold text-slate-800 sm:text-7xl">
                  Skunkworks
                </div>
                <div className="flex gap-2">
                  <SignInButton mode="modal">
                    <button className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-md border border-zinc-900 bg-white px-4 py-2 text-zinc-900">
                      Sign up
                    </button>
                  </SignUpButton>
                </div>
              </div>
            </div>
          </SignedOut>
          <SignedIn>
            <div className="flex gap-2 p-2">
              <UserButton />
              <Link
                to="/"
                activeProps={{
                  className: "font-bold",
                }}
                activeOptions={{ exact: true }}
              >
                Home
              </Link>
            </div>
            {props.children}
          </SignedIn>
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}
