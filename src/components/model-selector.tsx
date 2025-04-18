import { twMerge } from "tailwind-merge";
import React from "react";

/** Add new options in a single place */
const MODEL_OPTIONS = [
  { value: "gpt-4.1", label: "gpt-4.1 ($8)" },
  { value: "gpt-4o-mini", label: "gpt-4o-mini ($0.60)" },
  { value: "o4-mini", label: "o4-mini ($4.40)" },
  { value: "o3", label: "o3 ($40)" },
] as const;

export type ModelValue = (typeof MODEL_OPTIONS)[number]["value"];

interface ModelSelectorProps {
  /** The currently‑selected model id */
  value: ModelValue;
  /** Called when the user chooses a different model */
  onChange: (model: ModelValue) => void;
  /** Optional additional Tailwind / merged classes */
  className?: string;
}

/**
 * A generalized drop‑in selector for LLM model choices.
 * Keeps the option list in one place and hides the markup details.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  className,
}) => (
  <select
    value={value}
    onChange={(e) => {
      onChange(e.target.value as ModelValue);
    }}
    className={twMerge(
      "w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-gray-400 focus:outline-none",
      className,
    )}
  >
    {MODEL_OPTIONS.map(({ value, label }) => (
      <option key={value} value={value}>
        {label}
      </option>
    ))}
  </select>
);
