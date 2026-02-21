const { ethers } = require("ethers");

function normalizeAddress(v) {
  return ethers.getAddress(String(v || "").trim());
}

function toDecimalAmount(v) {
  const n = typeof v === "string" ? Number(v) : Number(v);
  if (!Number.isFinite(n)) throw new Error("amount 无效");
  const fixed = n.toFixed(4);
  if (!/^-?\d+\.\d{4}$/.test(fixed)) throw new Error("amount 格式无效");
  return fixed;
}

async function ensureWalletRow(conn, { walletAddress, role }) {
  const addr = normalizeAddress(walletAddress);
  const r = String(role || "USER").toUpperCase() === "INSTITUTION" ? "INSTITUTION" : "USER";
  await conn.execute(
    `INSERT INTO trust_wallets (wallet_address, role, balance)
     VALUES (?, ?, 0.0000)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [addr, r]
  );
  return { walletAddress: addr, role: r };
}

async function getWalletForUpdate(conn, { walletAddress }) {
  const addr = normalizeAddress(walletAddress);
  const [rows] = await conn.execute(
    `SELECT wallet_address, role, balance
     FROM trust_wallets
     WHERE wallet_address = ?
     LIMIT 1 FOR UPDATE`,
    [addr]
  );
  const row = rows?.[0] || null;
  if (!row) return null;
  return {
    walletAddress: String(row.wallet_address || ""),
    role: String(row.role || ""),
    balance: Number(row.balance || 0)
  };
}

async function creditWallet(conn, { walletAddress, role, amount, actionType, targetId }) {
  const { walletAddress: addr, role: r } = await ensureWalletRow(conn, { walletAddress, role });
  const amt = toDecimalAmount(amount);
  await conn.execute("UPDATE trust_wallets SET balance = balance + ? WHERE wallet_address = ?", [amt, addr]);
  await conn.execute(
    `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
     VALUES (?, ?, ?, ?, 'SUCCESS')`,
    [r, addr, String(actionType || "BILL_CREDIT"), String(targetId || "")]
  );
  const w = await getWalletForUpdate(conn, { walletAddress: addr });
  return w ? w.balance : null;
}

async function deductWallet(conn, { walletAddress, role, amount, actionType, targetId }) {
  const { walletAddress: addr, role: r } = await ensureWalletRow(conn, { walletAddress, role });
  const amt = toDecimalAmount(amount);
  const w = await getWalletForUpdate(conn, { walletAddress: addr });
  const balance = Number(w?.balance || 0);
  if (balance + 1e-9 < Number(amt)) {
    const e = new Error("余额不足");
    e.statusCode = 402;
    throw e;
  }
  await conn.execute("UPDATE trust_wallets SET balance = balance - ? WHERE wallet_address = ?", [amt, addr]);
  await conn.execute(
    `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
     VALUES (?, ?, ?, ?, 'SUCCESS')`,
    [r, addr, String(actionType || "BILL_DEDUCT"), String(targetId || "")]
  );
  if (Number(amt) > 0) {
    await conn.execute(
      `INSERT INTO trust_platform_revenue (id, balance)
       VALUES ('platform', ?)
       ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)`,
      [amt]
    );
  }
  const after = await getWalletForUpdate(conn, { walletAddress: addr });
  return after ? after.balance : null;
}

module.exports = { normalizeAddress, ensureWalletRow, getWalletForUpdate, creditWallet, deductWallet };
