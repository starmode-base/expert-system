import { toolMap } from "./tools";

type ToolName = keyof typeof toolMap;

export interface LlmToolCall {
  name: string;
  arguments?: unknown;
  call_id?: string;
  id?: string;
}

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

function getCallId(toolCall: LlmToolCall, idx: number) {
  return toolCall.call_id ?? toolCall.id ?? `toolcall_${idx}`;
}

function jsonStringifySafe(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Failed to serialize tool output" });
  }
}

export async function executeToolCalls(toolCalls: LlmToolCall[]) {
  const results: ToolExecutionResult[] = [];
  const outputs: OpenAIFunctionCallOutputItem[] = [];

  for (const [idx, toolCall] of toolCalls.entries()) {
    const callId = getCallId(toolCall, idx);
    const name = toolCall.name;

    if (!name || typeof name !== "string") {
      const result: ToolExecutionResult = {
        ok: false,
        name: "",
        callId,
        error: "Tool call is missing a valid name",
        details: toolCall,
      };
      results.push(result);
      outputs.push({
        type: "function_call_output",
        call_id: callId,
        output: jsonStringifySafe(result),
      });
      continue;
    }

    if (!(name in toolMap)) {
      const result: ToolExecutionResult = {
        ok: false,
        name,
        callId,
        error: `Unknown tool: ${name}`,
        details: { availableTools: Object.keys(toolMap) },
      };
      results.push(result);
      outputs.push({
        type: "function_call_output",
        call_id: callId,
        output: jsonStringifySafe(result),
      });
      continue;
    }

    const tool = toolMap[name as ToolName] as unknown as (
      args: Record<string, unknown>,
    ) => unknown;
    const args = parseToolArguments(toolCall.arguments);

    try {
      const output = await tool(args);
      const result: ToolExecutionResult = { ok: true, name, callId, output };
      results.push(result);
      outputs.push({
        type: "function_call_output",
        call_id: callId,
        output: jsonStringifySafe(output),
      });
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
      outputs.push({
        type: "function_call_output",
        call_id: callId,
        output: jsonStringifySafe(result),
      });
    }
  }

  return { results, outputs };
}
