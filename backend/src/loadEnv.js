const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function loadEnv() {
  const root = path.resolve(__dirname, "..");
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    return { loaded: true, path: envPath };
  }
  return { loaded: false, path: envPath };
}

module.exports = { loadEnv };

