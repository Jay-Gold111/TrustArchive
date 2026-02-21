const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { exec, query } = require("./db");
const { calculateTrustScore, maybeAnchorToChain } = require("./score");
const { syncOnce } = require("./listener");
const { optional, optionalInt } = require("./env");
const { getProvider, getIssuerBatchContract, getCredentialCenterContract } = require("./chain");
const { trustConnectRouter } = require("./trustconnect/routes");
const { authRouter } = require("./auth/routes");

function gatewayUrlForCid(cid) {
  const c = String(cid || "").trim();
  if (!c) return "";
  const g = optional("PINATA_GATEWAY", "").trim();
  if (g) return `https://${g}/ipfs/${c}`;
  return `https://gateway.pinata.cloud/ipfs/${c}`;
}

async function fetchJsonFromCid(cid) {
  const url = gatewayUrlForCid(cid);
  if (!url) throw new Error("缺少 CID");
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`IPFS 获取失败（${res.status}）`);
  return await res.json();
}

function normalizeAddress(addr) {
  return ethers.getAddress(String(addr || "").trim());
}

function ensureCid(cid) {
  const c = String(cid || "").trim();
  if (!c) throw new Error("cid 不能为空");
  if (c.length > 128) throw new Error("cid 过长");
  return c;
}

async function lookupUserByCid(cid) {
  const rows = await query(
    "SELECT user_address FROM safe_link_creations WHERE cid = ? ORDER BY created_at DESC LIMIT 1",
    [cid]
  );
  const v = rows?.[0]?.user_address ? String(rows[0].user_address) : "";
  return v ? normalizeAddress(v) : "";
}

function validateSafeVerifyPayload(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "invalid" };
  if (String(raw.scheme || "") !== "secure-verify-v1") return { ok: false, reason: "invalid" };
  const expiresAt = Number(raw.expiresAt || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return { ok: false, reason: "tampered" };
  const issuerName = typeof raw.issuerName === "string" ? raw.issuerName.trim() : "";
  const issuerAddress = typeof raw.issuerAddress === "string" ? raw.issuerAddress.trim() : "";
  const issuedAt = Number(raw.issuedAt || 0);
  const image = typeof raw.image === "string" ? raw.image.trim() : "";
  const holder = typeof raw.holder === "string" ? raw.holder.trim() : "";
  if (!issuerAddress || !issuerName || !issuedAt || !image || holder !== "anonymous") return { ok: false, reason: "tampered" };
  if (raw.tokenId != null || raw.tokenID != null || raw.privateCid != null || raw.attachmentCid != null || raw.attachmentCID != null) {
    return { ok: false, reason: "tampered" };
  }
  const fields = Array.isArray(raw.fields) ? raw.fields : [];
  const normalizedFields = fields
    .map((f) => ({
      label: typeof f?.label === "string" ? f.label.trim() : "",
      value: typeof f?.value === "string" ? f.value.trim() : ""
    }))
    .filter((x) => x.label && x.value)
    .slice(0, 32);
  return {
    ok: true,
    expiresAt,
    issuerName,
    issuerAddress,
    issuedAt,
    image,
    fields: normalizedFields
  };
}

async function upsertUserRow(userAddress) {
  await exec("INSERT INTO user_trust_scores (user_address) VALUES (?) ON DUPLICATE KEY UPDATE user_address = user_address", [
    userAddress
  ]);
}

async function reconcileOnchainSbtCount(userAddress) {
  const addr = normalizeAddress(userAddress);
  const provider = getProvider();
  let batch = 0;
  let cred = 0;
  try {
    const batchC = getIssuerBatchContract(provider);
    batch = Number(await batchC.balanceOf(addr));
  } catch {
    batch = 0;
  }
  try {
    const cc = getCredentialCenterContract(provider);
    cred = Number(await cc.balanceOf(addr));
  } catch {
    cred = 0;
  }
  const total = Math.max(0, (Number.isFinite(batch) ? batch : 0) + (Number.isFinite(cred) ? cred : 0));
  await exec("UPDATE user_trust_scores SET sbt_count = ? WHERE user_address = ?", [Math.floor(total), addr]);
  return { batch, credentialCenter: cred, total };
}

function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api", trustConnectRouter());
  app.use("/api/auth", authRouter());

  app.get("/api/trust-score/:address", async (req, res) => {
    try {
      const user = normalizeAddress(req.params.address);
      await upsertUserRow(user);
      if (String(req.query.sync || "") === "1") {
        await syncOnce();
      }
      if (String(req.query.refresh || "") === "1") {
        await reconcileOnchainSbtCount(user);
        const calc = await calculateTrustScore(user);
        if (calc.changed) await maybeAnchorToChain(calc);
      }
      const rows = await query(
        `SELECT user_address, sbt_count, base_score, behavior_score, stability_score, risk_penalty, bonus_score, total_score, trust_level, updated_at
         FROM user_trust_scores WHERE user_address = ?`,
        [user]
      );
      const row = rows?.[0] || null;
      res.json({
        ok: true,
        userAddress: user,
        sbtCount: Number(row?.sbt_count || 0),
        trustLevel: String(row?.trust_level || "C"),
        totalScore: Number(row?.total_score || 0),
        breakdown: {
          base: Number(row?.base_score || 0),
          behavior: Number(row?.behavior_score || 0),
          stability: Number(row?.stability_score || 0),
          riskPenalty: Number(row?.risk_penalty || 0),
          bonus: 0
        },
        updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : ""
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.post("/api/share/safe-link/created", async (req, res) => {
    try {
      const user = normalizeAddress(req.body?.userAddress);
      const cid = ensureCid(req.body?.cid);
      const expiresAt = Number(req.body?.expiresAt || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= 0) throw new Error("expiresAt 无效");
      await upsertUserRow(user);
      await exec(
        `INSERT INTO safe_link_creations (user_address, cid, expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE user_address = VALUES(user_address), expires_at = VALUES(expires_at)`,
        [user, cid, Math.floor(expiresAt)]
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.post("/api/verify/safe-link", async (req, res) => {
    try {
      const cid = ensureCid(req.body?.cid);
      const user = req.body?.userAddress ? normalizeAddress(req.body?.userAddress) : await lookupUserByCid(cid);
      if (user) await upsertUserRow(user);

      let raw = null;
      try {
        raw = await fetchJsonFromCid(cid);
      } catch (e) {
        await exec(
          `INSERT INTO verification_logs (user_address, cid, issuer_address, issuer_name, is_success, reason)
           VALUES (?, ?, '', '', 0, 'invalid')`,
          [user || "0x0000000000000000000000000000000000000000", cid]
        );
        if (user) {
          const calc = await calculateTrustScore(user);
          if (calc.changed) await maybeAnchorToChain(calc);
        }
        res.status(400).json({ ok: false, error: e?.message || String(e) });
        return;
      }

      const parsed = validateSafeVerifyPayload(raw);
      if (!parsed.ok) {
        await exec(
          `INSERT INTO verification_logs (user_address, cid, issuer_address, issuer_name, is_success, reason)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [user || "0x0000000000000000000000000000000000000000", cid, String(raw?.issuerAddress || ""), String(raw?.issuerName || ""), parsed.reason]
        );
        if (user) {
          const calc = await calculateTrustScore(user);
          if (calc.changed) await maybeAnchorToChain(calc);
        }
        res.status(400).json({ ok: false, error: "验证失败", reason: parsed.reason });
        return;
      }

      const expired = Date.now() > parsed.expiresAt;
      if (expired) {
        await exec(
          `INSERT INTO verification_logs (user_address, cid, issuer_address, issuer_name, is_success, reason)
           VALUES (?, ?, ?, ?, 0, 'expired')`,
          [user || "0x0000000000000000000000000000000000000000", cid, parsed.issuerAddress, parsed.issuerName]
        );
        if (user) {
          const calc = await calculateTrustScore(user);
          if (calc.changed) await maybeAnchorToChain(calc);
        }
        res.status(200).json({ ok: true, expired: true });
        return;
      }

      await exec(
        `INSERT INTO verification_logs (user_address, cid, issuer_address, issuer_name, is_success, reason)
         VALUES (?, ?, ?, ?, 1, '')`,
        [user || "0x0000000000000000000000000000000000000000", cid, parsed.issuerAddress, parsed.issuerName]
      );
      if (user) {
        const calc = await calculateTrustScore(user);
        if (calc.changed) await maybeAnchorToChain(calc);
      }

      res.json({
        ok: true,
        expired: false,
        userAddress: user || "",
        issuerName: parsed.issuerName,
        issuerAddress: parsed.issuerAddress,
        issuedAt: parsed.issuedAt,
        fields: parsed.fields
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.get("/api/verify/safe-link/status/:cid", async (req, res) => {
    try {
      const cid = ensureCid(req.params.cid);
      const created = await query(
        "SELECT user_address, expires_at, created_at FROM safe_link_creations WHERE cid = ? ORDER BY created_at DESC LIMIT 1",
        [cid]
      );
      const expiresAt = Number(created?.[0]?.expires_at || 0);
      const createdAt = created?.[0]?.created_at ? new Date(created[0].created_at).toISOString() : "";
      const agg = await query(
        "SELECT SUM(is_success = 1) AS success, COUNT(*) AS total FROM verification_logs WHERE cid = ?",
        [cid]
      );
      const success = Number(agg?.[0]?.success || 0);
      const total = Number(agg?.[0]?.total || 0);
      res.json({
        ok: true,
        cid,
        createdAt,
        expiresAt,
        expired: expiresAt ? Date.now() > expiresAt : false,
        verified: success > 0,
        successCount: success,
        totalCount: total
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  return app;
}

async function startServer() {
  const app = createServer();
  const port = optionalInt("PORT", 8787);
  return await new Promise((resolve) => {
    const server = app.listen(port, () => resolve({ server, port }));
  });
}

module.exports = {
  startServer
};
