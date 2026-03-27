import { useState } from "react";

export function CopyPre({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  return (
    <div className="group relative">
      <pre
        className={
          className ??
          "overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 pr-10 font-mono text-xs leading-relaxed text-slate-700"
        }
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-600"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <svg
            className="h-3.5 w-3.5 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
