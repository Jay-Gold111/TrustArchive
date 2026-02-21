const { loadEnv } = require("./loadEnv");
loadEnv();

const { startServer } = require("./server");
const { startListener } = require("./listener");
const { startCron } = require("./score");
const { ping } = require("./db");
const { ensureSchema } = require("./schema");
const { start: startTreasuryListener } = require("./billing/TreasuryListener");

function shouldStartTreasuryListener() {
  const enabled = String(process.env.ENABLE_TREASURY_LISTENER || "").trim();
  if (enabled === "0" || enabled.toLowerCase() === "false") return false;
  const addr = String(process.env.TREASURY_ADDRESS || "").trim();
  const ws = String(process.env.TREASURY_WS_URL || "").trim();
  const rpc = String(process.env.TREASURY_RPC_URL || "").trim();
  return Boolean(addr && (ws || rpc));
}

async function main() {
  try {
    await ping();
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (msg.includes("Access denied") && msg.includes("using password: NO")) {
      throw new Error(
        "MySQL 认证失败：当前未提供 MYSQL_PASSWORD。\n请在 backend/.env 里配置 MYSQL_PASSWORD（以及 MYSQL_USER/MYSQL_HOST），然后重启服务。"
      );
    }
    throw e;
  }
  try {
    await ensureSchema();
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (msg.includes("doesn't exist")) {
      throw new Error("数据库表不存在：请先运行 npm run migrate，或确认服务有建表权限。");
    }
    throw e;
  }
  const { port } = await startServer();
  await startListener();
  startCron();
  if (shouldStartTreasuryListener()) {
    startTreasuryListener().catch((e) => {
      process.stderr.write(`[TreasuryListener] fatal ${e?.stack || e}\n`);
    });
  } else {
    process.stdout.write("[TreasuryListener] skipped (missing TREASURY_ADDRESS or TREASURY_WS_URL/TREASURY_RPC_URL)\n");
  }
  process.stdout.write(`backend listening on ${port}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
