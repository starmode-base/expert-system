import { twMerge } from "tailwind-merge";
import React from "react";
import type { ModelPower } from "~/lib/model-versions";

export const MODEL_OPTIONS = [
  { value: "max", label: "Maximum" },
  { value: "high", label: "High" },
  { value: "balanced", label: "Balanced" },
  { value: "economy", label: "Economy" },
] as const satisfies readonly { value: ModelPower; label: string }[];

export type ModelValue = ModelPower;

interface ModelSelectorProps {
  /** The currently selected model power */
  value: ModelValue;
  /** Called when the user chooses a different model */
  onChange: (model: ModelValue) => void;
  /** Optional additional Tailwind / merged classes */
  className?: string;
}

/**
 * A generalized drop-in selector for LLM power choices.
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
