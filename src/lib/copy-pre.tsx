import { CopyIcon, CheckIcon } from "lucide-react";
import { useState } from "react";

interface CopyPreProps {
  children: string;
  className?: string;
}

export function CopyPre(props: CopyPreProps) {
  const { children, className } = props;
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
          "overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 pr-10 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-slate-700"
        }
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 opacity-100 transition-opacity hover:text-slate-600 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
