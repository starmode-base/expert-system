import { SignInButton, SignUpButton } from "@clerk/tanstack-start";
import { useEffect, useRef, useState } from "react";
import { InsightsFeed } from "~/components/insight-feed/insights-feed";
import { type InsightsItem } from "~/server/queries";

export interface SignedOutExperienceProps {
  items: InsightsItem[];
}

export function SignedOutExperience(props: SignedOutExperienceProps) {
  const items = props.items;
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const [fadeProgress, setFadeProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function update() {
      setPrefersReducedMotion(mediaQuery.matches);
    }

    update();

    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const el = feedScrollRef.current;
    if (!el) return;

    let rafId = 0;

    function computeProgress() {
      const currentEl = feedScrollRef.current;
      if (!currentEl) return;

      const startPx = 1640;
      const endPx = 2060;
      const raw = (currentEl.scrollTop - startPx) / (endPx - startPx);
      const next = Math.min(1, Math.max(0, raw));
      setFadeProgress(next);
    }

    function onScroll() {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(computeProgress);
    }

    computeProgress();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const feedOpacity = 2 - fadeProgress;
  const logoOpacity = fadeProgress;
  const isFadeComplete = fadeProgress >= 0.999;
  const feedStyle: React.CSSProperties = prefersReducedMotion
    ? { opacity: feedOpacity }
    : {
        opacity: feedOpacity,
        filter: `blur(${fadeProgress * 8}px)`,
      };

  const logoStyle: React.CSSProperties = prefersReducedMotion
    ? { opacity: logoOpacity }
    : {
        opacity: logoOpacity,
        transform: `translateY(${(1 - fadeProgress) * 10}px) scale(${
          0.98 + fadeProgress * 0.02
        })`,
      };

  return (
    <div className="relative flex h-dvh flex-col bg-slate-100 px-2 sm:px-8">
      <div
        className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center"
        style={logoStyle}
      >
        <div className="flex flex-col items-center gap-4 px-4 sm:gap-6">
          <img
            src="/starmode-logo.svg"
            alt=""
            className="mx-auto w-[min(480px,80vw)]"
          />
          {/* ΞXPERT-SYSTΞM */}
          <div className="text-center text-4xl leading-tight font-semibold text-balance text-slate-800 sm:text-6xl">
            ΞXPERT-SYSTΞM
          </div>
          <div
            aria-hidden={isFadeComplete ? undefined : true}
            className={
              isFadeComplete ? "pointer-events-auto" : "pointer-events-none"
            }
          >
            <SignUpButton mode="modal">
              <button
                disabled={!isFadeComplete}
                className="w-[min(22rem,90vw)] cursor-pointer rounded-md border border-zinc-900 bg-white px-6 py-3 text-base font-medium text-zinc-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
        <div
          className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          style={feedStyle}
        >
          <div className="text-center text-4xl leading-tight font-semibold text-balance text-slate-800 sm:text-6xl">
            ΞXPERT-SYSTΞM
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <SignInButton mode="modal">
              <button className="w-full rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white sm:w-auto">
                Sign in
              </button>
            </SignInButton>
            <div className="hidden sm:block">
              <SignUpButton mode="modal">
                <button className="w-full rounded-md border border-zinc-900 bg-white px-4 py-2 text-zinc-900 sm:w-auto">
                  Sign up
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col will-change-[opacity,filter,transform]"
          style={feedStyle}
        >
          <div ref={feedScrollRef} className="flex-1 overflow-y-auto">
            <InsightsFeed items={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
