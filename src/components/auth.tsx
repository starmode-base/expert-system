import { useRouteContext } from "@tanstack/react-router";
import { cloneElement, type ReactElement, type MouseEventHandler } from "react";
export function useAuth() {
  const { auth } = useRouteContext({ from: "__root__" });
  return auth;
}
export function SignInButton({
  children,
}: {
  children: ReactElement<{ onClick?: MouseEventHandler }>;
}) {
  return cloneElement(children, {
    onClick: () => {
      window.location.assign(
        `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
    },
  });
}
export function SignedIn({ children }: { children: React.ReactNode }) {
  return useAuth().isSignedIn ? children : null;
}
export function SignedOut({ children }: { children: React.ReactNode }) {
  return useAuth().isSignedIn ? null : children;
}
export function UserButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className="cursor-pointer text-sm">
        Sign out
      </button>
    </form>
  );
}
