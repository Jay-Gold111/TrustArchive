const express = require("express");
const { ethers } = require("ethers");
const crypto = require("crypto");
const { getPool } = require("../db");
const { ensureSchema } = require("../schema");
const { requireRole } = require("../trustconnect/rbac");
const { generateMnemonic12 } = require("./mnemonic");
const { openSeedEnvelopeLegacy } = require("./seedEnvelopeLegacy");
const {
  decryptAes256Gcm,
  deriveRecoveryKeyFromMnemonic,
  encryptAes256Gcm,
  newSaltB64,
  normalizeMnemonic
} = require("./recoveryCrypto");

const NOTARY_SEED_ABI = ["function getSeedEnvelope(address _user) view returns (string)"];

function sendError(res, e) {
  const status = Number(e?.statusCode || e?.status || 0) || 400;
  res.status(status).json({ ok: false, error: String(e?.message || e) });
}

async function withTx(fn) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
    }
    throw e;
  } finally {
    conn.release();
  }
}

async function getUserRowForUpdate(conn, walletAddress) {
  const [rows] = await conn.execute(
    `SELECT wallet_address,
            recovery_envelope, encrypted_mnemonic, recovery_salt, recovery_kdf_iters
     FROM users
     WHERE wallet_address = ?
     LIMIT 1 FOR UPDATE`,
    [walletAddress]
  );
  return rows?.[0] || null;
}

async function ensureUser(conn, walletAddress) {
  await conn.execute(
    `INSERT INTO users (wallet_address)
     VALUES (?)
     ON DUPLICATE KEY UPDATE wallet_address = wallet_address`,
    [walletAddress]
  );
}

async function openPasswordEnvelopeFromChain({ walletAddress, currentPassword }) {
  const notaryAddress = String(
    process.env.NOTARY_ADDRESS || process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || ""
  ).trim();
  const rpcUrl = String(process.env.CHAIN_RPC_URL || "").trim();
  if (!notaryAddress) throw new Error("服务未配置 NOTARY_ADDRESS（Notary 合约地址）");
  if (!rpcUrl) throw new Error("服务未配置 CHAIN_RPC_URL");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const notary = new ethers.Contract(ethers.getAddress(notaryAddress), NOTARY_SEED_ABI, provider);
  const raw = await notary.getSeedEnvelope(ethers.getAddress(walletAddress));
  const text = typeof raw === "string" ? raw : "";
  if (!text) {
    const e = new Error("尚未设置个人密码（未找到种子信封）");
    e.statusCode = 400;
    throw e;
  }
  let envelope = null;
  try {
    envelope = JSON.parse(text);
  } catch {
    const e = new Error("种子信封格式无效");
    e.statusCode = 400;
    throw e;
  }
  const seedHex = openSeedEnvelopeLegacy({ personalPassword: currentPassword, envelope });
  return seedHex;
}

function parseWords(v) {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  return String(v || "")
    .trim()
    .split(/\s+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function authRouter() {
  const r = express.Router();

  r.post("/mnemonic/setup", requireRole(["USER", "INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      await ensureSchema();
      const actor = req.actor;
      const wallet = String(actor.id || "");
      const currentPassword = String(req.body?.current_password || req.body?.currentPassword || "");
      if (!currentPassword) throw new Error("current_password 不能为空");

      const phrase = generateMnemonic12();
      const words = phrase.split(/\s+/g);
      const recoverySalt = newSaltB64(16);
      const recoveryIters = 120000;

      const out = await withTx(async (conn) => {
        await ensureUser(conn, wallet);
        const row = await getUserRowForUpdate(conn, wallet);
        const masterSeedHex = await openPasswordEnvelopeFromChain({ walletAddress: wallet, currentPassword });
        const masterKey = Buffer.from(masterSeedHex, "hex");
        if (masterKey.length !== 32) throw new Error("Master Key 格式无效（需为 32 bytes）");

        const recoveryKey = deriveRecoveryKeyFromMnemonic({ mnemonicWordsOrPhrase: phrase, saltB64: recoverySalt, iterations: recoveryIters });
        const recoveryEnvelope = encryptAes256Gcm({ key: recoveryKey, plainText: masterSeedHex, aad: `recovery:${wallet}` });
        const encryptedMnemonic = encryptAes256Gcm({ key: masterKey, plainText: phrase, aad: `mnemonic:${wallet}` });

        await conn.execute(
          `UPDATE users
           SET recovery_envelope = ?, encrypted_mnemonic = ?, recovery_salt = ?, recovery_kdf_iters = ?
           WHERE wallet_address = ?`,
          [recoveryEnvelope, encryptedMnemonic, recoverySalt, Math.floor(recoveryIters), wallet]
        );

        return { words };
      });

      res.json({ ok: true, mnemonic: out.words });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/mnemonic/view", requireRole(["USER", "INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      await ensureSchema();
      const actor = req.actor;
      const wallet = String(actor.id || "");
      const currentPassword = String(req.body?.current_password || req.body?.currentPassword || "");
      if (!currentPassword) throw new Error("current_password 不能为空");

      const out = await withTx(async (conn) => {
        await ensureUser(conn, wallet);
        const row = await getUserRowForUpdate(conn, wallet);
        const encryptedMnemonic = String(row?.encrypted_mnemonic || "").trim();
        if (!encryptedMnemonic) throw new Error("尚未生成助记词备份");
        const masterSeedHex = await openPasswordEnvelopeFromChain({ walletAddress: wallet, currentPassword });
        const masterKey = Buffer.from(masterSeedHex, "hex");
        if (masterKey.length !== 32) throw new Error("Master Key 格式无效（需为 32 bytes）");
        const phrase = decryptAes256Gcm({ key: masterKey, envelope: encryptedMnemonic, aad: `mnemonic:${wallet}` });
        const words = phrase.trim().split(/\s+/g);
        return { words };
      });

      res.json({ ok: true, mnemonic: out.words });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/password/recover", requireRole(["USER", "INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      await ensureSchema();
      const actor = req.actor;
      const wallet = String(actor.id || "");
      const words = parseWords(req.body?.mnemonic || req.body?.words || req.body?.phrase || "");
      const newPassword = String(req.body?.new_password || req.body?.newPassword || "");
      if (words.length !== 12) throw new Error("mnemonic 必须为 12 个单词");
      if (!newPassword) throw new Error("new_password 不能为空");

      const out = await withTx(async (conn) => {
        await ensureUser(conn, wallet);
        const row = await getUserRowForUpdate(conn, wallet);
        const recoverySalt = String(row?.recovery_salt || "").trim();
        const recoveryEnv = String(row?.recovery_envelope || "").trim();
        const recoveryIters = Number(row?.recovery_kdf_iters || 120000);
        if (!recoverySalt || !recoveryEnv) {
          const e = new Error("未设置恢复信封，无法找回密码");
          e.statusCode = 400;
          throw e;
        }
        const recoveryKey = deriveRecoveryKeyFromMnemonic({
          mnemonicWordsOrPhrase: normalizeMnemonic(words),
          saltB64: recoverySalt,
          iterations: recoveryIters
        });

        let masterSeedHex = "";
        try {
          masterSeedHex = decryptAes256Gcm({ key: recoveryKey, envelope: recoveryEnv, aad: `recovery:${wallet}` });
        } catch (err) {
          const e = new Error("助记词错误");
          e.statusCode = 401;
          throw e;
        }
        const seedHex = String(masterSeedHex || "").trim();
        if (!/^[0-9a-f]{64}$/i.test(seedHex)) throw new Error("Master Key 格式无效（需为 32 bytes hex）");

        const iterations = 120000;
        const salt = Buffer.from(newSaltB64(16), "base64");
        const iv = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(String(newPassword), salt, iterations, 32, "sha256");
        const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
        const ciphertext = Buffer.concat([cipher.update(Buffer.from(seedHex, "utf8")), cipher.final()]).toString("base64");
        const nextEnvelope = {
          v: 1,
          kdf: "pbkdf2-sha256",
          iterations,
          saltHex: salt.toString("hex"),
          ivHex: iv.toString("hex"),
          ciphertext
        };

        return { seedEnvelope: JSON.stringify(nextEnvelope) };
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  return r;
}

module.exports = { authRouter };
