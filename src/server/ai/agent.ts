import { ANALYTICS_TOOLS, toolByName, type ToolContext } from "./tools";
import type { AIProvider, ChatMessage, ToolSpec } from "./provider";

/**
 * The AI Funnel Analyst.
 *
 * A tool-using agent, not a chatbot over documents. The loop is: the model
 * reads the question, calls analytics tools, reads what they returned, and
 * only then answers. It has no access to the database and no way to produce a
 * metric other than by calling a tool.
 *
 * Everything the model saw is recorded as an execution trace, so any claim in
 * an answer can be checked against the data it came from. The trace holds tool
 * calls and results, not the model's reasoning.
 */

const MAX_ITERATIONS = 6;

export type TraceEntry = {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  error?: string;
};

export type AgentResult = {
  answer: string;
  trace: TraceEntry[];
  toolsUsed: string[];
  truncated: boolean;
};

const SYSTEM_PROMPT = `You are the analyst for a funnel intelligence product. You help an owner of a small
business decide what to do next with their funnel.

HOW YOU WORK

1. Read the question and decide which analytics tools answer it.
2. Call them. Call more than one when a claim needs corroboration.
3. Only then write your answer.

ABSOLUTE RULES

- Never state a number that did not come from a tool result in this conversation.
  You cannot calculate business metrics yourself. If you need a figure, call a tool.
- Never invent a confidence level or a percentage. Confidence comes from the
  tool output; when a tool reports confidence as UNAVAILABLE or a value as null,
  say the figure is unavailable and why.
- If a tool reports the tracking health score is low or null, qualify every
  conclusion you draw from that project's data.
- Never claim causation. Tools report what happened and what correlates. Say
  "coincided with" or "may be driven by", never "caused by", unless a tool
  explicitly reports a controlled result.
- Distinguish revenue from attributed revenue, and percentage points from
  percent. The tools use these terms precisely and so must you.
- If the data cannot answer the question, say so and name what would be needed.

HOW TO ANSWER

Be direct and brief. Lead with the finding, not with a description of your
process. Use these headings, and omit any that you have nothing real to put under:

What happened
Why it matters
Likely drivers
Evidence
Recommended investigation
Suggested experiment
Potential upside
Confidence

Under Evidence, cite the actual figures the tools returned. Under Confidence,
state what the tool reported and why, or "Confidence unavailable" with the
reason. Write in plain prose. No emoji.`;

function toolSpecs(): ToolSpec[] {
  return ANALYTICS_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export async function runAnalyst(
  provider: AIProvider,
  toolContext: ToolContext,
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<AgentResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((entry) => ({ role: entry.role, content: entry.content }) as ChatMessage),
    { role: "user", content: question },
  ];

  const trace: TraceEntry[] = [];
  const specs = toolSpecs();

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const result = await provider.chat(messages, specs);

    if (result.toolCalls.length === 0) {
      return {
        answer: result.content.trim() || "I could not produce an answer for that.",
        trace,
        toolsUsed: [...new Set(trace.map((entry) => entry.tool))],
        truncated: false,
      };
    }

    messages.push({
      role: "assistant",
      content: result.content,
      toolCalls: result.toolCalls,
    });

    for (const call of result.toolCalls) {
      const started = Date.now();
      const tool = toolByName(call.name);

      if (!tool) {
        const entry: TraceEntry = {
          tool: call.name,
          args: call.arguments,
          result: null,
          durationMs: 0,
          error: "Unknown tool",
        };
        trace.push(entry);
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify({ error: "No such tool" }),
        });
        continue;
      }

      try {
        // Arguments are validated before they reach a query. The model is an
        // untrusted caller like any other.
        const parsed = tool.schema.parse(call.arguments ?? {});
        const output = await tool.run(
          parsed as Record<string, unknown>,
          toolContext,
        );

        trace.push({
          tool: call.name,
          args: call.arguments,
          result: output,
          durationMs: Date.now() - started,
        });

        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify(output),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Tool execution failed";

        trace.push({
          tool: call.name,
          args: call.arguments,
          result: null,
          durationMs: Date.now() - started,
          error: message,
        });

        // The failure is handed back to the model rather than thrown, so it can
        // correct its arguments or choose a different tool.
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify({ error: message }),
        });
      }
    }
  }

  return {
    answer:
      "I ran out of steps before reaching a conclusion. Try asking about one metric at a time.",
    trace,
    toolsUsed: [...new Set(trace.map((entry) => entry.tool))],
    truncated: true,
  };
}
