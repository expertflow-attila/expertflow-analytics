/**
 * MCP (Model Context Protocol) tool definitions.
 * These expose deterministic analytics functions to external AI clients.
 * No business metric is ever calculated by the model itself.
 */

export const mcpTools = [
  {
    name: "get_funnel_steps",
    description: "Return the current funnel steps with visitors, conversion rates and revenue.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_opportunities",
    description: "Return ranked opportunities with estimated monthly upside, confidence and evidence.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_attribution",
    description: "Return channel-level attributed revenue for a given model (first, last, linear, u-shaped).",
    inputSchema: {
      type: "object",
      properties: { model: { type: "string", enum: ["first", "last", "linear", "u-shaped"] } },
      required: ["model"]
    }
  },
  {
    name: "get_tracking_health",
    description: "Return tracking health score and open issues.",
    inputSchema: { type: "object", properties: {} }
  }
];

export function handleMcpTool(name: string, args: Record<string, unknown>) {
  // Placeholder responses — wire to real queries once EventStore is live
  switch (name) {
    case "get_funnel_steps":
      return { steps: [], note: "Demo MCP — connect EventStore for live data." };
    case "get_opportunities":
      return { opportunities: [], note: "Demo MCP." };
    case "get_attribution":
      return { model: args.model, channels: [], note: "Demo MCP." };
    case "get_tracking_health":
      return { score: null, issues: [], note: "Demo MCP." };
    default:
      return { error: "Unknown tool" };
  }
}
