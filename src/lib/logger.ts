type Details = Record<string, string | number | boolean | null | undefined>;
export const logger = {
  info(event: string, details: Details = {}) { console.info(JSON.stringify({ level: "info", event, ...details })); },
  error(event: string, details: Details = {}) { console.error(JSON.stringify({ level: "error", event, ...details })); },
};

