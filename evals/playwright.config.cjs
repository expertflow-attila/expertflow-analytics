const path = require("path");
module.exports = {
  testDir: ".",
  testMatch: "*.spec.cjs",
  workers: 1,
  timeout: 90000,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(__dirname, "artifacts/results.json") }],
  ],
  outputDir: path.join(__dirname, "artifacts/traces"),
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 1000 },
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
};
