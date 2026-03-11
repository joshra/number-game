const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4281",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 4281",
    cwd: __dirname,
    port: 4281,
    reuseExistingServer: true,
  },
});
