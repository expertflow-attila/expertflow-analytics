const http = require("node:http");
const messages = [];
let failNext = false;
http
  .createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/emails") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      if (failNext) {
        failNext = false;
        res.writeHead(503);
        res.end(JSON.stringify({ name: "application_error" }));
        return;
      }
      messages.push(JSON.parse(raw));
      res.end(JSON.stringify({ id: "local-eval-message" }));
    } else if (req.method === "POST" && req.url === "/fail-next") {
      failNext = true;
      res.end("{}");
    } else if (req.method === "GET" && req.url === "/messages") {
      res.end(JSON.stringify(messages));
    } else {
      res.writeHead(404);
      res.end("{}");
    }
  })
  .listen(3199, "127.0.0.1", () =>
    console.log("Local recovery mail mock ready"),
  );
