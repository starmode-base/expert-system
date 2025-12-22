import { ArrowUpOnSquareIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

interface ShareInsightButtonProps {
  insightId: string;
}

async function copyToClipboard(text: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy link", text);
    return false;
  }
}

export function ShareInsightButton(props: ShareInsightButtonProps) {
  const router = useRouter();
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  return (
    <button
      type="button"
      className={
        shareLinkCopied
          ? "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"
          : "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-700"
      }
      aria-label={shareLinkCopied ? "Copied share link" : "Copy share link"}
      onClick={async () => {
        const href = router.buildLocation({
          to: "/insight/$insightId",
          params: { insightId: props.insightId },
        }).href;

        const fullUrl = new URL(href, window.location.origin).toString();
        const copied = await copyToClipboard(fullUrl);
        if (!copied) return;

        setShareLinkCopied(true);
        window.setTimeout(() => {
          setShareLinkCopied(false);
        }, 2000);
      }}
    >
      {shareLinkCopied ? (
        <CheckIcon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ArrowUpOnSquareIcon className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{shareLinkCopied ? "Copied" : "Share"}</span>
    </button>
  );
}
