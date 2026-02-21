const { loadEnv } = require("../loadEnv");
loadEnv();

const { ethers } = require("ethers");
const { getPool } = require("../db");
const { ensureSchema } = require("../schema");
const { normalizeAddress } = require("./wallets");

const TREASURY_ABI = [
  "event DepositReceived(address indexed user, uint256 amount)"
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requiredEnv(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

function toDecimal4FromUnits(amount, decimals) {
  const d = BigInt(Math.max(0, Math.min(36, Number(decimals || 18))));
  const scale = 10n ** d;
  const scaled = (BigInt(amount) * 10000n) / scale;
  const intPart = scaled / 10000n;
  const fracPart = scaled % 10000n;
  return `${intPart.toString()}.${fracPart.toString().padStart(4, "0")}`;
}

async function getLastBlock(conn, stateId) {
  const [rows] = await conn.execute("SELECT last_block FROM sync_state WHERE id = ? LIMIT 1", [stateId]);
  const n = Number(rows?.[0]?.last_block || 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

async function setLastBlock(conn, stateId, lastBlock) {
  const b = Math.max(0, Math.floor(Number(lastBlock || 0)));
  await conn.execute(
    "INSERT INTO sync_state (id, last_block) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_block = VALUES(last_block)",
    [stateId, b]
  );
}

async function creditWalletOnDeposit({ conn, walletAddress, amountRaw, amountDec, txHash, logIndex, blockNumber }) {
  const addr = normalizeAddress(walletAddress);
  const [res] = await conn.execute(
    `INSERT IGNORE INTO trust_treasury_deposits (tx_hash, log_index, block_number, wallet_address, amount_raw, amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [String(txHash || ""), Number(logIndex || 0), Number(blockNumber || 0), addr, String(amountRaw || ""), String(amountDec || "0.0000")]
  );
  const inserted = Number(res?.affectedRows || 0) > 0;
  if (!inserted) return { ok: true, duplicated: true };

  await conn.execute(
    `INSERT INTO trust_wallets (wallet_address, role, balance)
     VALUES (?, 'USER', ?)
     ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)`,
    [addr, String(amountDec)]
  );
  await conn.execute(
    `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
     VALUES ('API', ?, 'TREASURY_DEPOSIT', ?, 'SUCCESS')`,
    [addr, `${String(txHash || "")}:${Number(logIndex || 0)}`]
  );
  return { ok: true, duplicated: false };
}

async function scanOnce({ provider, contract, startBlock }) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const stateId = "treasury_deposit";
    const latest = await provider.getBlockNumber();
    let fromBlock = await getLastBlock(conn, stateId);
    if (fromBlock <= 0) fromBlock = Math.max(0, Number(startBlock || 0));
    if (fromBlock > latest) {
      await setLastBlock(conn, stateId, latest);
      await conn.commit();
      return { ok: true, fromBlock, latest, processed: 0 };
    }

    const toBlock = latest;
    await conn.commit();

    const logs = await contract.queryFilter(contract.filters.DepositReceived(), fromBlock, toBlock);
    let processed = 0;
    for (const ev of logs) {
      const user = ev?.args?.user;
      const amount = ev?.args?.amount;
      const txHash = ev?.transactionHash || "";
      const logIndex = Number(ev?.index || ev?.logIndex || 0);
      const blockNumber = Number(ev?.blockNumber || 0);

      const decimals = Number(process.env.TREASURY_TOKEN_DECIMALS || 18);
      const amountDec = toDecimal4FromUnits(amount, decimals);

      const c2 = await pool.getConnection();
      try {
        await c2.beginTransaction();
        await creditWalletOnDeposit({
          conn: c2,
          walletAddress: user,
          amountRaw: amount.toString(),
          amountDec,
          txHash,
          logIndex,
          blockNumber
        });
        await setLastBlock(c2, stateId, Math.max(blockNumber, fromBlock));
        await c2.commit();
      } catch (e) {
        try {
          await c2.rollback();
        } catch {
        }
        throw e;
      } finally {
        c2.release();
      }

      processed += 1;
    }

    const c3 = await pool.getConnection();
    try {
      await c3.beginTransaction();
      await setLastBlock(c3, stateId, toBlock);
      await c3.commit();
    } finally {
      c3.release();
    }

    return { ok: true, fromBlock, latest: toBlock, processed };
  } finally {
    conn.release();
  }
}

async function start() {
  await ensureSchema();
  const treasuryAddress = requiredEnv("TREASURY_ADDRESS");
  const wsUrl = String(process.env.TREASURY_WS_URL || "").trim();
  const rpcUrl = String(process.env.TREASURY_RPC_URL || "").trim();
  if (!wsUrl && !rpcUrl) throw new Error("缺少 TREASURY_WS_URL 或 TREASURY_RPC_URL");
  const provider = wsUrl ? new ethers.WebSocketProvider(wsUrl) : new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);

  const startBlock = Number(process.env.TREASURY_START_BLOCK || 0);
  const intervalMs = Math.max(3000, Math.floor(Number(process.env.TREASURY_POLL_MS || 15000)));
  const maxRetry = Math.max(1, Math.floor(Number(process.env.TREASURY_MAX_RETRY || 10)));

  let attempt = 0;
  for (;;) {
    try {
      const r = await scanOnce({ provider, contract, startBlock });
      attempt = 0;
      process.stdout.write(
        `[TreasuryListener] ok from=${r.fromBlock} to=${r.latest} processed=${r.processed} at=${new Date().toISOString()}\n`
      );
      await sleep(intervalMs);
    } catch (e) {
      attempt += 1;
      process.stderr.write(`[TreasuryListener] error attempt=${attempt} ${e?.stack || e}\n`);
      if (attempt >= maxRetry) {
        process.stderr.write("[TreasuryListener] reached max retries, exiting\n");
        process.exit(1);
      }
      const backoff = Math.min(60_000, 1000 * 2 ** Math.min(10, attempt));
      await sleep(backoff);
    }
  }
}

if (require.main === module) {
  start().catch((e) => {
    process.stderr.write(`[TreasuryListener] fatal ${e?.stack || e}\n`);
    process.exit(1);
  });
}

module.exports = { start };
