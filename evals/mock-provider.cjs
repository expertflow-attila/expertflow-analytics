const original = global.fetch;
global.fetch = async (input, init) => {
  if (String(input).startsWith("https://api.openai.com/")) {
    require("fs").writeFileSync(
      require("path").join(__dirname, "artifacts/mock-provider-request.json"),
      init.body,
    );
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: "Local audit response", role: "assistant" } },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  return original(input, init);
};
