import { ResponseFunctionToolCall } from "openai/resources/responses/responses.mjs";
import { toolMap } from "./tool-map";

type ToolName = keyof typeof toolMap;

export type ToolExecutionResult =
  | {
      ok: true;
      name: string;
      callId: string;
      output: unknown;
    }
  | {
      ok: false;
      name: string;
      callId: string;
      error: string;
      details?: unknown;
    };

export interface OpenAIFunctionCallOutputItem {
  type: "function_call_output";
  call_id: string;
  output: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) {
    return {};
  }

  if (isRecord(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (isRecord(parsed)) {
        return parsed;
      }
      return { value: parsed };
    } catch {
      return { value: trimmed };
    }
  }

  return { value: raw };
}

function jsonStringifySafe(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Failed to serialize tool output" });
  }
}

export async function executeToolCalls(toolCalls: ResponseFunctionToolCall[]) {
  const results: ToolExecutionResult[] = [];
  const outputs: OpenAIFunctionCallOutputItem[] = [];
  const fullOutputContext: (
    | OpenAIFunctionCallOutputItem
    | ResponseFunctionToolCall
  )[] = [];

  for (const toolCall of toolCalls) {
    const callId = toolCall.call_id;
    const name = toolCall.name;

    fullOutputContext.push(toolCall);

    // Check if the tool is valid
    if (!(name in toolMap)) {
      const result: ToolExecutionResult = {
        ok: false,
        name,
        callId,
        error: `Unknown tool: ${name}`,
        details: { availableTools: Object.keys(toolMap) },
      };
      results.push(result);

      const outputItem: OpenAIFunctionCallOutputItem = {
        type: "function_call_output",
        call_id: callId,
        output: jsonStringifySafe(result),
      };

      outputs.push(outputItem);
      fullOutputContext.push(outputItem);
      continue;
    }

    const tool = toolMap[name as ToolName] as unknown as (
      args: Record<string, unknown>,
    ) => unknown;

    const args = parseToolArguments(toolCall.arguments);

    try {
      console.log("***** EXECUTING TOOL", name);
      const output = await tool(args);

      const result: ToolExecutionResult = { ok: true, name, callId, output };
      results.push(result);

      const outputItem: OpenAIFunctionCallOutputItem = {
        type: "function_call_output",
        call_id: callId,
        output: jsonStringifySafe(output),
      };
      fullOutputContext.push(outputItem);
      outputs.push(outputItem);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tool execution failed";
      const result: ToolExecutionResult = {
        ok: false,
        name,
        callId,
        error: message,
        details: err,
      };
      results.push(result);
      const outputItem: OpenAIFunctionCallOutputItem = {
        type: "function_call_output",
        call_id: callId,
        output: jsonStringifySafe(result),
      };
      fullOutputContext.push(outputItem);
      outputs.push(outputItem);
    }
  }

  return { results, outputs, fullOutputContext };
}
