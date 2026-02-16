import { twMerge } from "tailwind-merge";
import React from "react";
import { models } from "~/models";

/** Add new options in a single place */
export const MODEL_OPTIONS = [
  { value: "gpt-5.1", label: "gpt-5.1 ($10)" },
  { value: models.standard, label: "gpt-5-mini ($2)" },
  { value: models.lightweight, label: "gpt-5-nano ($0.40)" },
  { value: "gpt-5-pro", label: "gpt-5-pro ($120)" },
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
