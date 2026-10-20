import { env } from "@/env";

/**
 * AI provider abstraction.
 *
 * Deliberately built on plain HTTP rather than provider SDKs: the surface this
 * product needs is one call with tools, and three SDKs would be three
 * dependencies to keep current for a feature the app is designed to work
 * without.
 *
 * The whole feature is optional. Nothing in the analytics layer depends on it,
 * and with no key configured the AI page says so rather than degrading.
 */

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatResult = {
  content: string;
  toolCalls: ToolCall[];
};

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  chat(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatResult>;
}

export type ProviderConfig = {
  provider: "openai" | "anthropic" | "ollama";
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
  ollama: "llama3.1",
} as const;

/* --- OpenAI-compatible ---------------------------------------------------- */

class OpenAIProvider implements AIProvider {
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
    readonly id = "openai",
  ) {}

  async chat(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(toOpenAIMessage),
        tools: tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI request failed: ${response.status} ${await safeText(response)}`,
      );
    }

    const body = await response.json();
    const choice = body.choices?.[0]?.message ?? {};

    type OpenAIToolCall = {
      id: string;
      function: { name: string; arguments: string };
    };

    return {
      content: choice.content ?? "",
      toolCalls: ((choice.tool_calls ?? []) as OpenAIToolCall[]).map(
        (call) => ({
          id: call.id,
          name: call.function.name,
          arguments: parseJson(call.function.arguments),
        }),
      ),
    };
  }
}

function toOpenAIMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }

  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    };
  }

  return { role: message.role, content: message.content };
}

/* --- Anthropic ------------------------------------------------------------ */

class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.anthropic.com/v1",
  ) {}

  async chat(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatResult> {
    // Anthropic takes the system prompt as a separate field, not a message.
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => (message as { content: string }).content)
      .join("\n\n");

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        temperature: 0.2,
        system: system || undefined,
        messages: toAnthropicMessages(
          messages.filter((message) => message.role !== "system"),
        ),
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic request failed: ${response.status} ${await safeText(response)}`,
      );
    }

    const body = await response.json();
    const blocks: Array<Record<string, unknown>> = body.content ?? [];

    return {
      content: blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text as string)
        .join("\n")
        .trim(),
      toolCalls: blocks
        .filter((block) => block.type === "tool_use")
        .map((block) => ({
          id: block.id as string,
          name: block.name as string,
          arguments: (block.input as Record<string, unknown>) ?? {},
        })),
    };
  }
}

function toAnthropicMessages(
  messages: ChatMessage[],
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (message.role === "tool") {
      // Tool results are user-role content blocks in Anthropic's format, and
      // consecutive results must be merged into one message.
      const block = {
        type: "tool_result",
        tool_use_id: message.toolCallId,
        content: message.content,
      };

      const last = result[result.length - 1];
      if (last?.role === "user" && Array.isArray(last.content)) {
        (last.content as unknown[]).push(block);
      } else {
        result.push({ role: "user", content: [block] });
      }
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      const content: Array<Record<string, unknown>> = [];
      if (message.content)
        content.push({ type: "text", text: message.content });
      for (const call of message.toolCalls) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        });
      }
      result.push({ role: "assistant", content });
      continue;
    }

    result.push({ role: message.role, content: message.content });
  }

  return result;
}

/* --- factory -------------------------------------------------------------- */

export function createProvider(config: ProviderConfig): AIProvider | null {
  const model = config.model ?? DEFAULT_MODELS[config.provider];

  switch (config.provider) {
    case "openai": {
      const key = config.apiKey ?? env.OPENAI_API_KEY;
      return key ? new OpenAIProvider(model, key, config.baseUrl) : null;
    }
    case "anthropic": {
      const key = config.apiKey ?? env.ANTHROPIC_API_KEY;
      return key ? new AnthropicProvider(model, key, config.baseUrl) : null;
    }
    case "ollama": {
      // Ollama exposes an OpenAI-compatible endpoint and needs no key.
      const base =
        config.baseUrl ?? env.OLLAMA_BASE_URL ?? "http://localhost:11434";
      return new OpenAIProvider(model, "ollama", `${base}/v1`, "ollama");
    }
    default:
      return null;
  }
}

/** Resolves the provider a project should use, or null when AI is unavailable. */
export function resolveProvider(
  stored?: ProviderConfig | null,
): AIProvider | null {
  if (stored) return createProvider(stored);

  // Platform-level fallback for self-hosters who set a key in the environment
  // rather than storing one per organization.
  if (env.ANTHROPIC_API_KEY) return createProvider({ provider: "anthropic" });
  if (env.OPENAI_API_KEY) return createProvider({ provider: "openai" });
  if (env.OLLAMA_BASE_URL) return createProvider({ provider: "ollama" });
  return null;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 400);
  } catch {
    return "";
  }
}

function parseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
