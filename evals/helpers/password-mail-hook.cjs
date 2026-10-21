// Local eval transport only; never deployed or imported by application code.
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = typeof input === "string" ? input : input?.url || String(input);
  if (url === "https://api.resend.com/emails") {
    return originalFetch("http://127.0.0.1:3199/emails", init);
  }
  return originalFetch(input, init);
};
