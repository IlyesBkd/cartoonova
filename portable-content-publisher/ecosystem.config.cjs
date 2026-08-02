const path = require("node:path");

const root = path.resolve(process.env.PUBLISHER_ROOT || __dirname);
const prefix = process.env.PUBLISHER_PROCESS_PREFIX || "content-publisher";
const common = {
  cwd: root,
  script: "src/app/cli.ts",
  interpreter: "node",
  node_args: "--import tsx",
  autorestart: true,
  watch: false,
  max_restarts: 10,
  restart_delay: 60000,
  merge_logs: true,
  env: {
    PUBLISHER_ROOT: root,
    PROJECT_CONFIG: process.env.PROJECT_CONFIG || path.join(root, "config/project.json"),
    DATA_DIR: process.env.DATA_DIR || path.join(root, "data"),
    STATE_DIR: process.env.STATE_DIR || path.join(root, ".state"),
    TEMP_DIR: process.env.TEMP_DIR || path.join(root, ".tmp"),
    LOG_DIR: process.env.LOG_DIR || path.join(root, "logs"),
    AI_ADAPTER: process.env.AI_ADAPTER || "mock",
    AI_ENDPOINT: process.env.AI_ENDPOINT || "",
    AI_API_KEY: process.env.AI_API_KEY || "",
    AI_MODEL: process.env.AI_MODEL || "editorial-model",
    AI_TRANSLATION_MODEL: process.env.AI_TRANSLATION_MODEL || "translation-model",
    SITE_URL: process.env.SITE_URL || "https://example.org",
    LOG_LEVEL: process.env.LOG_LEVEL || "info"
  }
};

module.exports = {
  apps: [
    { ...common, name: `${prefix}-generate`, args: "worker generate", out_file: path.join(root, "logs/generate-out.log"), error_file: path.join(root, "logs/generate-error.log") },
    { ...common, name: `${prefix}-publish`, args: "worker publish", out_file: path.join(root, "logs/publish-out.log"), error_file: path.join(root, "logs/publish-error.log") },
    { ...common, name: `${prefix}-seo`, args: "worker seo", out_file: path.join(root, "logs/seo-out.log"), error_file: path.join(root, "logs/seo-error.log") }
  ]
};
