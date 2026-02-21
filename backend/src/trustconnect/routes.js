const express = require("express");
const { ethers } = require("ethers");
const { getPool } = require("../db");
const { requireRole, requireApiKey } = require("./rbac");
const { TrustScoreService } = require("./TrustScoreService");
const { newShareId, newTicket } = require("./ids");
const { encrypt, decrypt } = require("./aes256gcm");
const crypto = require("crypto");
const { verifySbtOwnership } = require("./chainVerify");
const { calculateTrustScore, maybeAnchorToChain } = require("../score");
const { deductWallet, ensureWalletRow } = require("../billing/wallets");

const TREASURY_EVENT_ABI = ["event DepositReceived(address indexed user, uint256 amount)"];

function toDecimal4FromUnits(amount, decimals) {
  const d = BigInt(Math.max(0, Math.min(36, Number(decimals || 18))));
  const scale = 10n ** d;
  const scaled = (BigInt(amount) * 10000n) / scale;
  const intPart = scaled / 10000n;
  const fracPart = scaled % 10000n;
  return `${intPart.toString()}.${fracPart.toString().padStart(4, "0")}`;
}

function nowSql() {
  return new Date();
}

function ensurePositiveInt(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} 无效`);
  return Math.floor(n);
}

function normalizeAddress(v) {
  return ethers.getAddress(String(v || "").trim());
}

function parseExpireAt(v, name) {
  const s = String(v || "").trim();
  if (!s) throw new Error(`${name} 不能为空`);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`${name} 无效`);
  return d;
}

function safeJson(v) {
  if (v == null) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function obfuscatedSubjectId(addr) {
  const a = String(addr || "").trim().toLowerCase();
  if (!a) return "";
  return `TA-${crypto.createHash("sha256").update(a).digest("hex").slice(0, 10)}`;
}

function newOpaqueToken(len = 56) {
  const bytes = crypto.randomBytes(64);
  return bytes.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "").slice(0, len);
}

function safeLimit(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function getAdminAllowlist() {
  const raw = String(process.env.ADMIN_ALLOWLIST || process.env.ADMIN_WALLET_ADDRESS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.toLowerCase());
}

function ensureAdminAllowlisted(addr) {
  const list = getAdminAllowlist();
  if (!list.length) throw new Error("服务未配置 ADMIN_ALLOWLIST");
  const v = String(addr || "").toLowerCase();
  if (!list.includes(v)) throw new Error("无权访问");
}

function sendError(res, e) {
  const code = Number(e?.statusCode || e?.status || 400);
  const status = Number.isFinite(code) && code >= 200 && code <= 599 ? code : 400;
  res.status(status).json({ ok: false, error: e?.message || String(e) });
}

async function withTransaction(fn) {
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

function router() {
  const r = express.Router();

  r.get("/connect/requirements", async (req, res) => {
    try {
      const status = String(req.query.status || "OPEN").trim().toUpperCase();
      const limit = safeLimit(req.query.limit, 50);
      const rows = await withTransaction(async (conn) => {
        const params = [];
        let sql =
          "SELECT id, institution_id, title, description, status, application_count, created_at FROM trust_requirements";
        if (status !== "ALL") {
          sql += " WHERE status = ?";
          params.push(status);
        }
        sql += ` ORDER BY created_at DESC LIMIT ${limit}`;
        const [list] = await conn.execute(sql, params);
        return list || [];
      });
      res.json({
        ok: true,
        items: rows.map((r) => ({
          id: Number(r.id),
          institutionId: String(r.institution_id || ""),
          title: String(r.title || ""),
          description: String(r.description || ""),
          status: String(r.status || "OPEN"),
          applicationCount: Number(r.application_count || 0),
          tags: [],
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : ""
        }))
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/connect/requirements/:id", async (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!Number.isFinite(id) || id <= 0) throw new Error("id 无效");
      const row = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT id, institution_id, title, description, status, application_count, created_at
           FROM trust_requirements
           WHERE id = ?
           LIMIT 1`,
          [id]
        );
        return rows?.[0] || null;
      });
      if (!row) {
        res.status(404).json({ ok: false, error: "需求不存在" });
        return;
      }
      res.json({
        ok: true,
        item: {
          id: Number(row.id),
          institutionId: String(row.institution_id || ""),
          title: String(row.title || ""),
          description: String(row.description || ""),
          status: String(row.status || "OPEN"),
          applicationCount: Number(row.application_count || 0),
          tags: [],
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : ""
        }
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.post("/connect/requirements", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const title = String(req.body?.title || "").trim();
      const description = String(req.body?.description || "").trim();
      const secretContact = String(req.body?.secret_contact || req.body?.secretContact || "").trim();
      if (!title) throw new Error("title 不能为空");
      if (!description) throw new Error("description 不能为空");
      if (!secretContact) throw new Error("secret_contact 不能为空");
      const status = String(req.body?.status || "OPEN").trim().toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN";

      const out = await withTransaction(async (conn) => {
        await deductWallet(conn, {
          walletAddress: institution,
          role: "INSTITUTION",
          amount: "5.0000",
          actionType: "BILL_REQUIREMENT_CREATE",
          targetId: `req:new`
        });
        const [ins] = await conn.execute(
          `INSERT INTO trust_requirements (institution_id, title, description, secret_contact_encrypted, status, application_count, created_at, updated_at)
           VALUES (?, ?, ?, '', ?, 0, NOW(), NOW())`,
          [institution, title, description, status]
        );
        const id = Number(ins?.insertId || 0);
        const encrypted = encrypt(secretContact, `req:${id}`);
        await conn.execute("UPDATE trust_requirements SET secret_contact_encrypted = ? WHERE id = ?", [encrypted, id]);

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('INSTITUTION', ?, 'REQUIREMENT_CREATE', ?, 'SUCCESS')`,
          [institution, String(id)]
        );
        return { id };
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.put("/connect/requirements/:id", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const id = Number(req.params.id || 0);
      if (!Number.isFinite(id) || id <= 0) throw new Error("id 无效");

      const title = req.body?.title != null ? String(req.body.title).trim() : null;
      const description = req.body?.description != null ? String(req.body.description).trim() : null;
      const secretContact = req.body?.secret_contact != null ? String(req.body.secret_contact).trim() : null;
      const statusRaw = req.body?.status != null ? String(req.body.status).trim().toUpperCase() : null;
      const status = statusRaw ? (statusRaw === "CLOSED" ? "CLOSED" : "OPEN") : null;

      if (title != null && !title) throw new Error("title 不能为空");
      if (description != null && !description) throw new Error("description 不能为空");
      if (secretContact != null && !secretContact) throw new Error("secret_contact 不能为空");

      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT id, institution_id, title, description, status, application_count
           FROM trust_requirements
           WHERE id = ?
           LIMIT 1 FOR UPDATE`,
          [id]
        );
        const row = rows?.[0];
        if (!row) throw new Error("需求不存在");
        if (normalizeAddress(row.institution_id) !== institution && actor.role !== "ADMIN") throw new Error("无权修改该需求");

        const updates = [];
        const params = [];
        if (title != null) {
          updates.push("title = ?");
          params.push(title);
        }
        if (description != null) {
          updates.push("description = ?");
          params.push(description);
        }
        if (status != null) {
          updates.push("status = ?");
          params.push(status);
        }
        if (secretContact != null) {
          const encrypted = encrypt(secretContact, `req:${id}`);
          updates.push("secret_contact_encrypted = ?");
          params.push(encrypted);
        }

        if (updates.length > 0) {
          params.push(id);
          await conn.execute(`UPDATE trust_requirements SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
        }

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('INSTITUTION', ?, 'REQUIREMENT_UPDATE', ?, 'SUCCESS')`,
          [institution, String(id)]
        );

        const [afterRows] = await conn.execute(
          `SELECT id, institution_id, title, description, status, application_count, created_at, updated_at
           FROM trust_requirements WHERE id = ? LIMIT 1`,
          [id]
        );
        const after = afterRows?.[0] || null;
        return after
          ? {
              id: Number(after.id),
              institutionId: String(after.institution_id || ""),
              title: String(after.title || ""),
              description: String(after.description || ""),
              status: String(after.status || "OPEN"),
              applicationCount: Number(after.application_count || 0),
              createdAt: after.created_at ? new Date(after.created_at).toISOString() : "",
              updatedAt: after.updated_at ? new Date(after.updated_at).toISOString() : ""
            }
          : null;
      });

      res.json({ ok: true, item: out });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  async function deleteRequirementsByIds({ conn, ids, actor, institution }) {
    const idList = Array.isArray(ids) ? ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : [];
    if (idList.length === 0) throw new Error("ids 不能为空");

    const placeholders = idList.map(() => "?").join(",");
    const [ownedRows] = await conn.execute(
      `SELECT id, institution_id FROM trust_requirements WHERE id IN (${placeholders}) FOR UPDATE`,
      idList
    );
    const owned = ownedRows || [];
    if (owned.length !== idList.length) throw new Error("部分需求不存在");
    if (actor.role !== "ADMIN") {
      for (const r of owned) {
        if (normalizeAddress(r.institution_id) !== institution) throw new Error("包含非本机构的需求，禁止删除");
      }
    }

    const [apps] = await conn.execute(
      `SELECT id, normal_file_share_id, sbt_verify_ticket
       FROM trust_applications
       WHERE requirement_id IN (${placeholders})`,
      idList
    );
    const shareIds = Array.from(new Set((apps || []).map((a) => String(a.normal_file_share_id || "")).filter(Boolean)));
    const tickets = Array.from(new Set((apps || []).map((a) => String(a.sbt_verify_ticket || "")).filter(Boolean)));

    if (apps && apps.length) {
      await conn.execute(`DELETE FROM trust_applications WHERE requirement_id IN (${placeholders})`, idList);
    }
    if (shareIds.length) {
      const sp = shareIds.map(() => "?").join(",");
      await conn.execute(`DELETE FROM trust_file_shares WHERE share_id IN (${sp})`, shareIds);
    }
    if (tickets.length) {
      const tp = tickets.map(() => "?").join(",");
      await conn.execute(`DELETE FROM trust_verify_tickets WHERE ticket IN (${tp})`, tickets);
    }

    await conn.execute(`DELETE FROM trust_requirements WHERE id IN (${placeholders})`, idList);

    for (const rid of idList) {
      await conn.execute(
        `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
         VALUES ('INSTITUTION', ?, 'REQUIREMENT_DELETE', ?, 'SUCCESS')`,
        [institution, String(rid)]
      );
    }

    return { deleted: idList.length, ids: idList };
  }

  r.delete("/connect/requirements/:id", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const id = Number(req.params.id || 0);
      if (!Number.isFinite(id) || id <= 0) throw new Error("id 无效");

      const out = await withTransaction(async (conn) => {
        return await deleteRequirementsByIds({ conn, ids: [id], actor, institution });
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.post("/connect/requirements/batch-delete", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const out = await withTransaction(async (conn) => {
        return await deleteRequirementsByIds({ conn, ids, actor, institution });
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/connect/manage/requirements", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const rows = await withTransaction(async (conn) => {
        const [list] = await conn.execute(
          `SELECT id, institution_id, title, description, status, application_count, created_at
           FROM trust_requirements
           WHERE institution_id = ?
           ORDER BY created_at DESC`,
          [institution]
        );
        return list || [];
      });
      res.json({
        ok: true,
        items: rows.map((r) => ({
          id: Number(r.id),
          institutionId: String(r.institution_id || ""),
          title: String(r.title || ""),
          description: String(r.description || ""),
          status: String(r.status || "OPEN"),
          applicationCount: Number(r.application_count || 0),
          tags: [],
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : ""
        }))
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/connect/manage/applications", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const requirementId = Number(req.query.requirement_id || req.query.requirementId || 0);
      if (!Number.isFinite(requirementId) || requirementId <= 0) throw new Error("requirement_id 无效");

      const rows = await withTransaction(async (conn) => {
        const [reqRows] = await conn.execute(
          "SELECT id, institution_id FROM trust_requirements WHERE id = ? LIMIT 1",
          [requirementId]
        );
        const reqRow = reqRows?.[0] || null;
        if (!reqRow) throw new Error("需求不存在");
        if (normalizeAddress(reqRow.institution_id) !== institution && actor.role !== "ADMIN") throw new Error("无权访问该需求申请列表");

        const [list] = await conn.execute(
          `SELECT id, requirement_id, user_address, normal_file_share_id, sbt_verify_ticket, sbt_verify_tickets_json, status, created_at
           FROM trust_applications
           WHERE requirement_id = ?
           ORDER BY created_at DESC`,
          [requirementId]
        );
        return list || [];
      });

      res.json({
        ok: true,
        items: rows.map((r) => ({
          id: Number(r.id),
          requirementId: Number(r.requirement_id),
          userAddress: String(r.user_address || ""),
          normalFileShareId: String(r.normal_file_share_id || ""),
          sbtVerifyTicket: String(r.sbt_verify_ticket || ""),
          sbtVerifyTickets: Array.isArray(r.sbt_verify_tickets_json) ? r.sbt_verify_tickets_json : safeJson(r.sbt_verify_tickets_json) || [],
          status: String(r.status || "PENDING"),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : ""
        }))
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/connect/manage/applications/:id/score", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const applicationId = Number(req.params.id || 0);
      if (!Number.isFinite(applicationId) || applicationId <= 0) throw new Error("application_id 无效");

      const row = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT a.id, a.user_address, r.institution_id
           FROM trust_applications a
           JOIN trust_requirements r ON r.id = a.requirement_id
           WHERE a.id = ?
           LIMIT 1`,
          [applicationId]
        );
        return rows?.[0] || null;
      });
      if (!row) throw new Error("申请不存在");
      if (normalizeAddress(row.institution_id) !== institution && actor.role !== "ADMIN") throw new Error("无权查看该申请");

      const user = normalizeAddress(row.user_address);
      const calc = await calculateTrustScore(user);

      res.json({
        ok: true,
        subjectId: obfuscatedSubjectId(user),
        trustScore: calc.totalScore,
        trustLevel: calc.trustLevel
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.post("/connect/billing/upload", requireRole(["USER"]), async (req, res) => {
    try {
      const actor = req.actor;
      const user = normalizeAddress(actor.id);
      const requirementId = Number(req.body?.requirement_id || req.body?.requirementId || 0);
      if (!Number.isFinite(requirementId) || requirementId <= 0) throw new Error("requirement_id 无效");
      const actionId = String(req.body?.action_id || req.body?.actionId || "").trim();
      if (!actionId) throw new Error("action_id 不能为空");
      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT action_id, wallet_address, status, amount
           FROM trust_billing_ledger
           WHERE action_id = ?
           LIMIT 1 FOR UPDATE`,
          [actionId]
        );
        const row = rows?.[0] || null;
        if (row) {
          if (String(row.wallet_address || "").toLowerCase() !== user.toLowerCase()) throw new Error("action_id 不属于当前用户");
          if (String(row.status || "") === "REFUNDED") throw new Error("该上传扣费已退款");
          return { balance: null, duplicated: true };
        }

        const balance = await deductWallet(conn, {
          walletAddress: user,
          role: "USER",
          amount: "0.2000",
          actionType: "BILL_APPLY_UPLOAD",
          targetId: actionId
        });
        await conn.execute(
          `INSERT INTO trust_billing_ledger (action_id, wallet_address, role, action_type, amount, status)
           VALUES (?, ?, 'USER', 'UPLOAD', 0.2000, 'DEBITED')`,
          [actionId, user]
        );
        return { balance, duplicated: false };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/connect/billing/upload-refund", requireRole(["USER"]), async (req, res) => {
    try {
      const actor = req.actor;
      const user = normalizeAddress(actor.id);
      const actionId = String(req.body?.action_id || req.body?.actionId || "").trim();
      if (!actionId) throw new Error("action_id 不能为空");
      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT action_id, wallet_address, status
           FROM trust_billing_ledger
           WHERE action_id = ?
           LIMIT 1 FOR UPDATE`,
          [actionId]
        );
        const row = rows?.[0] || null;
        if (!row) throw new Error("找不到扣费记录");
        if (String(row.wallet_address || "").toLowerCase() !== user.toLowerCase()) throw new Error("action_id 不属于当前用户");
        if (String(row.status || "") === "REFUNDED") return { refunded: true, balance: null };

        const balance = await deductWallet(conn, {
          walletAddress: user,
          role: "USER",
          amount: "-0.2000",
          actionType: "BILL_APPLY_UPLOAD_REFUND",
          targetId: actionId
        });
        await conn.execute("UPDATE trust_billing_ledger SET status = 'REFUNDED' WHERE action_id = ?", [actionId]);
        return { refunded: true, balance };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/connect/billing/review-open", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const applicationId = Number(req.body?.application_id || req.body?.applicationId || 0);
      if (!Number.isFinite(applicationId) || applicationId <= 0) throw new Error("application_id 无效");
      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT a.id, r.institution_id
           FROM trust_applications a
           JOIN trust_requirements r ON r.id = a.requirement_id
           WHERE a.id = ?
           LIMIT 1 FOR UPDATE`,
          [applicationId]
        );
        const row = rows?.[0] || null;
        if (!row) throw new Error("申请不存在");
        if (normalizeAddress(row.institution_id) !== institution && actor.role !== "ADMIN") throw new Error("无权审核该申请");
        const balance = await deductWallet(conn, {
          walletAddress: institution,
          role: "INSTITUTION",
          amount: "1.0000",
          actionType: "BILL_REVIEW_OPEN",
          targetId: `review:${applicationId}`
        });
        return { balance };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.get("/connect/billing/balance", requireRole(["USER", "INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const addr = normalizeAddress(actor.id);
      const role = actor.role === "INSTITUTION" ? "INSTITUTION" : actor.role === "ADMIN" ? "INSTITUTION" : "USER";
      const out = await withTransaction(async (conn) => {
        await ensureWalletRow(conn, { walletAddress: addr, role });
        const [rows] = await conn.execute("SELECT wallet_address, role, balance, updated_at FROM trust_wallets WHERE wallet_address = ? LIMIT 1", [
          addr
        ]);
        const row = rows?.[0] || null;
        return {
          walletAddress: String(row?.wallet_address || addr),
          role: String(row?.role || role),
          balance: Number(row?.balance || 0),
          updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : ""
        };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.get("/connect/billing/revenue", requireRole(["ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const admin = normalizeAddress(actor.id);
      ensureAdminAllowlisted(admin);
      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute("SELECT balance, updated_at FROM trust_platform_revenue WHERE id = 'platform' LIMIT 1");
        const row = rows?.[0] || null;
        return {
          balance: Number(row?.balance || 0),
          updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : ""
        };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/connect/billing/recharge/confirm", requireRole(["USER", "INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const addr = normalizeAddress(actor.id);
      const txHash = String(req.body?.tx_hash || req.body?.txHash || "").trim();
      if (!txHash) throw new Error("tx_hash 不能为空");

      const treasuryAddress = String(process.env.TREASURY_ADDRESS || "").trim();
      const rpcUrl = String(process.env.TREASURY_RPC_URL || process.env.CHAIN_RPC_URL || "").trim();
      if (!treasuryAddress) throw new Error("服务未配置 TREASURY_ADDRESS");
      if (!rpcUrl) throw new Error("服务未配置 TREASURY_RPC_URL/CHAIN_RPC_URL");

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) throw new Error("未找到交易回执（tx_hash 无效或节点未同步）");
      if (Number(receipt.status || 0) !== 1) throw new Error("交易执行失败（status=0）");

      const iface = new ethers.Interface(TREASURY_EVENT_ABI);
      const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
      const matched = [];
      for (const l of logs) {
        if (!l?.address) continue;
        if (String(l.address).toLowerCase() !== treasuryAddress.toLowerCase()) continue;
        try {
          const parsed = iface.parseLog(l);
          if (!parsed || parsed.name !== "DepositReceived") continue;
          matched.push({ log: l, args: parsed.args });
        } catch {
        }
      }
      if (matched.length === 0) throw new Error("该交易未包含金库充值事件（DepositReceived）");

      const decimals = Number(process.env.TREASURY_TOKEN_DECIMALS || 18);
      const out = await withTransaction(async (conn) => {
        await ensureWalletRow(conn, { walletAddress: addr, role: actor.role === "INSTITUTION" ? "INSTITUTION" : "USER" });
        let creditedAny = false;
        for (const m of matched) {
          const user = normalizeAddress(m?.args?.user);
          if (user.toLowerCase() !== addr.toLowerCase()) continue;
          const amount = m?.args?.amount;
          const logIndex = Number(m?.log?.index || m?.log?.logIndex || 0);
          const blockNumber = Number(receipt.blockNumber || 0);
          const amountDec = toDecimal4FromUnits(amount, decimals);
          const [res1] = await conn.execute(
            `INSERT IGNORE INTO trust_treasury_deposits (tx_hash, log_index, block_number, wallet_address, amount_raw, amount)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [txHash, logIndex, blockNumber, addr, String(amount?.toString?.() || ""), String(amountDec)]
          );
          const inserted = Number(res1?.affectedRows || 0) > 0;
          if (!inserted) continue;
          creditedAny = true;
          await conn.execute(
            `UPDATE trust_wallets SET balance = balance + ? WHERE wallet_address = ?`,
            [String(amountDec), addr]
          );
          await conn.execute(
            `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
             VALUES ('API', ?, 'TREASURY_DEPOSIT', ?, 'SUCCESS')`,
            [addr, `${txHash}:${logIndex}`]
          );
        }
        const [rows] = await conn.execute("SELECT balance FROM trust_wallets WHERE wallet_address = ? LIMIT 1", [addr]);
        return { credited: creditedAny, balance: Number(rows?.[0]?.balance || 0) };
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/connect/billing/revenue/withdraw", requireRole(["ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const admin = normalizeAddress(actor.id);
      ensureAdminAllowlisted(admin);
      const amount = Number(req.body?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount 无效");
      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          "SELECT balance FROM trust_platform_revenue WHERE id = 'platform' LIMIT 1 FOR UPDATE"
        );
        const bal = Number(rows?.[0]?.balance || 0);
        if (bal + 1e-9 < amount) {
          const e = new Error("可提现收益不足");
          e.statusCode = 402;
          throw e;
        }
        await conn.execute("UPDATE trust_platform_revenue SET balance = balance - ? WHERE id = 'platform'", [
          amount.toFixed(4)
        ]);
        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('API', ?, 'REVENUE_WITHDRAW', ?, 'SUCCESS')`,
          [admin, String(amount)]
        );
        const [after] = await conn.execute("SELECT balance FROM trust_platform_revenue WHERE id = 'platform' LIMIT 1");
        return { balance: Number(after?.[0]?.balance || 0) };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/connect/apply", requireRole(["USER"]), async (req, res) => {
    try {
      const actor = req.actor;
      const user = normalizeAddress(actor.id);
      const requirementId = Number(req.body?.requirement_id || req.body?.requirementId || 0);
      if (!Number.isFinite(requirementId) || requirementId <= 0) throw new Error("requirement_id 无效");

      const cid = String(req.body?.cid || "").trim();
      if (!cid) throw new Error("cid 不能为空");

      const shareExpireAt = parseExpireAt(req.body?.file_share_expire_at || req.body?.expire_at || req.body?.expireAt, "expire_at");
      const maxViews = ensurePositiveInt(req.body?.max_views || req.body?.maxViews || 1, "max_views");

      const ticketExpireAt = parseExpireAt(req.body?.ticket_expire_at || req.body?.ticketExpireAt, "ticket_expire_at");
      const maxVerifyTimes = ensurePositiveInt(req.body?.max_verify_times || req.body?.maxVerifyTimes || 1, "max_verify_times");

      const sbtTokensRaw = Array.isArray(req.body?.sbt_tokens)
        ? req.body.sbt_tokens
        : Array.isArray(req.body?.sbtTokens)
          ? req.body.sbtTokens
          : [];
      const sbtTokens = (sbtTokensRaw || [])
        .map((x) => ({
          sbtTokenId: String(x?.sbt_token_id || x?.sbtTokenId || x?.tokenId || "").trim(),
          scopeJson: safeJson(x?.scope_json || x?.scopeJson || x?.scope || {})
        }))
        .filter((x) => x.sbtTokenId);

      const legacyTokenId = String(req.body?.sbt_token_id || req.body?.sbtTokenId || "").trim();
      const legacyScopeJson = safeJson(req.body?.scope_json || req.body?.scopeJson || {});
      if (!sbtTokens.length) {
        if (!legacyTokenId) throw new Error("请至少选择 1 个 SBT");
        sbtTokens.push({ sbtTokenId: legacyTokenId, scopeJson: legacyScopeJson });
      }
      const shareId = newShareId();

      const out = await withTransaction(async (conn) => {
        await deductWallet(conn, {
          walletAddress: user,
          role: "USER",
          amount: "0.8000",
          actionType: "BILL_APPLY_SUBMIT",
          targetId: `apply:req:${requirementId}`
        });
        const [pending] = await conn.execute(
          `SELECT id FROM trust_applications
           WHERE requirement_id = ? AND user_address = ? AND status = 'PENDING'
           LIMIT 1 FOR UPDATE`,
          [requirementId, user]
        );
        if (pending && pending.length) throw new Error("该需求下你已有待处理申请");

        await conn.execute(
          `INSERT INTO trust_file_shares (share_id, cid, expire_at, max_views, current_views, created_by, created_at)
           VALUES (?, ?, ?, ?, 0, ?, NOW())`,
          [shareId, cid, shareExpireAt, maxViews, user]
        );

        const tickets = [];
        for (const t of sbtTokens) {
          const ticket = newTicket();
          tickets.push(ticket);
          await conn.execute(
            `INSERT INTO trust_verify_tickets (ticket, user_address, sbt_token_id, expire_at, max_verify_times, used_times, scope_json, created_at)
             VALUES (?, ?, ?, ?, ?, 0, ?, NOW())`,
            [ticket, user, t.sbtTokenId, ticketExpireAt, maxVerifyTimes, JSON.stringify(t.scopeJson)]
          );
        }

        const [appRes] = await conn.execute(
          `INSERT INTO trust_applications (requirement_id, user_address, normal_file_share_id, sbt_verify_ticket, sbt_verify_tickets_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', NOW())`,
          [requirementId, user, shareId, tickets[0] || "", JSON.stringify(tickets)]
        );
        const applicationId = Number(appRes?.insertId || 0);

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('USER', ?, 'APPLY_SUBMIT', ?, 'SUCCESS')`,
          [user, String(applicationId)]
        );

        await conn.execute(
          "UPDATE trust_requirements SET application_count = application_count + 1 WHERE id = ?",
          [requirementId]
        );

        return { applicationId, shareId, ticket: tickets[0] || "", tickets };
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      sendError(res, e);
    }
  });

  r.post("/connect/review", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);
      const applicationId = Number(req.body?.application_id || req.body?.applicationId || 0);
      if (!Number.isFinite(applicationId) || applicationId <= 0) throw new Error("application_id 无效");
      const status = String(req.body?.status || "").trim().toUpperCase();
      if (!["PASSED", "REJECTED"].includes(status)) throw new Error("status 无效");

      const result = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT a.id, a.user_address, a.requirement_id, a.status AS old_status,
                  r.institution_id, r.secret_contact_encrypted
           FROM trust_applications a
           JOIN trust_requirements r ON r.id = a.requirement_id
           WHERE a.id = ?
           LIMIT 1 FOR UPDATE`,
          [applicationId]
        );
        const row = rows?.[0];
        if (!row) throw new Error("申请不存在");
        if (normalizeAddress(row.institution_id) !== institution && actor.role !== "ADMIN") throw new Error("无权审核该需求");

        await conn.execute("UPDATE trust_applications SET status = ?, reviewed_at = NOW() WHERE id = ?", [status, applicationId]);

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('INSTITUTION', ?, ?, ?, 'SUCCESS')`,
          [institution, status === "PASSED" ? "REVIEW_PASS" : "REVIEW_REJECT", String(applicationId)]
        );

        let contact = "";
        if (status === "PASSED") {
          contact = decrypt(String(row.secret_contact_encrypted || ""), `req:${row.requirement_id}`);
          const contactEnc = encrypt(String(contact || ""), `app:${applicationId}`);
          await conn.execute("UPDATE trust_applications SET institution_contact_encrypted = ? WHERE id = ?", [
            contactEnc,
            applicationId
          ]);
          const tss = new TrustScoreService({ conn });
          await tss.addPoints({
            userAddress: row.user_address,
            delta: 5,
            actionType: "SCORE_APPLY_PASSED",
            targetId: String(applicationId),
            actorType: "INSTITUTION",
            actorId: institution
          });
        } else {
          await conn.execute("UPDATE trust_applications SET institution_contact_encrypted = NULL WHERE id = ?", [applicationId]);
        }
        return {
          userAddress: normalizeAddress(row.user_address),
          requirementId: Number(row.requirement_id),
          status,
          contact
        };
      });

      const calc = await calculateTrustScore(result.userAddress);
      if (calc.changed) await maybeAnchorToChain(calc);

      res.json({
        ok: true,
        requirementId: result.requirementId,
        status: result.status,
        contact: result.contact,
        trustScore: calc.totalScore,
        trustLevel: calc.trustLevel,
        subjectId: obfuscatedSubjectId(result.userAddress)
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.post("/v1/verify/sbt", requireApiKey(), async (req, res) => {
    try {
      const ticket = String(req.body?.ticket || "").trim();
      if (!ticket) throw new Error("ticket 不能为空");
      const actor = req.actor;

      const result = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT ticket, user_address, sbt_token_id, expire_at, max_verify_times, used_times, scope_json
           FROM trust_verify_tickets
           WHERE ticket = ?
           LIMIT 1 FOR UPDATE`,
          [ticket]
        );
        const row = rows?.[0];
        if (!row) throw new Error("Ticket 不存在");

        const now = Date.now();
        const expireAt = new Date(row.expire_at).getTime();
        if (!expireAt || now > expireAt) throw new Error("Ticket 已过期");

        const maxTimes = Number(row.max_verify_times || 0);
        const used = Number(row.used_times || 0);
        if (used >= maxTimes) throw new Error("Ticket 已用尽");

        const scope = safeJson(row.scope_json);
        const contract = scope?.contract || scope?.contractType || "";
        const verify = await verifySbtOwnership({ userAddress: row.user_address, tokenId: row.sbt_token_id, contract });
        if (!verify.ok) throw new Error("链上校验失败：SBT 不属于该用户");

        await conn.execute("UPDATE trust_verify_tickets SET used_times = used_times + 1 WHERE ticket = ?", [ticket]);

        const tss = new TrustScoreService({ conn });
        await tss.addPoints({
          userAddress: row.user_address,
          delta: 3,
          actionType: "SCORE_SBT_VERIFY_SUCCESS",
          targetId: ticket,
          actorType: "API",
          actorId: actor.id
        });

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('API', ?, 'TICKET_VERIFY', ?, 'SUCCESS')`,
          [actor.id, ticket]
        );

        return {
          userAddress: normalizeAddress(row.user_address),
          subjectId: obfuscatedSubjectId(row.user_address),
          sbtTokenId: String(row.sbt_token_id),
          scopeJson: scope,
          usedTimes: used + 1,
          maxVerifyTimes: maxTimes
        };
      });

      const calc = await calculateTrustScore(result.userAddress);
      if (calc.changed) await maybeAnchorToChain(calc);

      res.json({
        ok: true,
        verified: true,
        subjectId: result.subjectId,
        sbtTokenId: result.sbtTokenId,
        scopeJson: result.scopeJson,
        usedTimes: result.usedTimes,
        maxVerifyTimes: result.maxVerifyTimes,
        trustScore: calc.totalScore,
        trustLevel: calc.trustLevel
      });
    } catch (e) {
      res.status(403).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.post("/connect/verify/sbt", requireRole(["INSTITUTION", "ADMIN"]), async (req, res) => {
    try {
      const ticket = String(req.body?.ticket || "").trim();
      if (!ticket) throw new Error("ticket 不能为空");
      const actor = req.actor;
      const institution = normalizeAddress(actor.id);

      const result = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT t.ticket, t.user_address, t.sbt_token_id, t.expire_at, t.max_verify_times, t.used_times, t.scope_json,
                  r.institution_id
           FROM trust_verify_tickets t
           JOIN trust_applications a
             ON a.sbt_verify_ticket = t.ticket
             OR JSON_CONTAINS(COALESCE(a.sbt_verify_tickets_json, JSON_ARRAY()), JSON_QUOTE(t.ticket))
           JOIN trust_requirements r ON r.id = a.requirement_id
           WHERE t.ticket = ?
           LIMIT 1 FOR UPDATE`,
          [ticket]
        );
        const row = rows?.[0];
        if (!row) throw new Error("Ticket 不存在或不属于该机构需求");
        if (normalizeAddress(row.institution_id) !== institution && actor.role !== "ADMIN") throw new Error("无权验证该票据");

        const now = Date.now();
        const expireAt = new Date(row.expire_at).getTime();
        if (!expireAt || now > expireAt) throw new Error("Ticket 已过期");

        const maxTimes = Number(row.max_verify_times || 0);
        const used = Number(row.used_times || 0);
        if (used >= maxTimes) throw new Error("Ticket 已用尽");

        const scope = safeJson(row.scope_json);
        const contract = scope?.contract || scope?.contractType || "";
        const verify = await verifySbtOwnership({ userAddress: row.user_address, tokenId: row.sbt_token_id, contract });
        if (!verify.ok) throw new Error("链上校验失败：SBT 不属于该用户");

        await conn.execute("UPDATE trust_verify_tickets SET used_times = used_times + 1 WHERE ticket = ?", [ticket]);

        const tss = new TrustScoreService({ conn });
        await tss.addPoints({
          userAddress: row.user_address,
          delta: 3,
          actionType: "SCORE_SBT_VERIFY_SUCCESS",
          targetId: ticket,
          actorType: "INSTITUTION",
          actorId: institution
        });

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('INSTITUTION', ?, 'TICKET_VERIFY', ?, 'SUCCESS')`,
          [institution, ticket]
        );

        return {
          userAddress: normalizeAddress(row.user_address),
          subjectId: obfuscatedSubjectId(row.user_address),
          sbtTokenId: String(row.sbt_token_id),
          scopeJson: scope,
          usedTimes: used + 1,
          maxVerifyTimes: maxTimes
        };
      });

      const calc = await calculateTrustScore(result.userAddress);
      if (calc.changed) await maybeAnchorToChain(calc);

      res.json({
        ok: true,
        verified: true,
        subjectId: result.subjectId,
        sbtTokenId: result.sbtTokenId,
        scopeJson: result.scopeJson,
        usedTimes: result.usedTimes,
        maxVerifyTimes: result.maxVerifyTimes,
        trustScore: calc.totalScore,
        trustLevel: calc.trustLevel
      });
    } catch (e) {
      res.status(403).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/connect/my/applications", requireRole(["USER"]), async (req, res) => {
    try {
      const actor = req.actor;
      const user = normalizeAddress(actor.id);
      const limit = safeLimit(req.query.limit, 50);

      const rows = await withTransaction(async (conn) => {
        const [list] = await conn.execute(
          `SELECT a.id, a.requirement_id, a.status, a.normal_file_share_id, a.sbt_verify_ticket,
                  a.reviewed_at, a.created_at,
                  r.title AS requirement_title, r.institution_id,
                  a.institution_contact_encrypted
           FROM trust_applications a
           JOIN trust_requirements r ON r.id = a.requirement_id
           WHERE a.user_address = ?
           ORDER BY a.created_at DESC
           LIMIT ${limit}`,
          [user]
        );
        return list || [];
      });

      const items = rows.map((r) => {
        const status = String(r.status || "PENDING");
        let contact = "";
        if (status === "PASSED" && r.institution_contact_encrypted) {
          try {
            contact = decrypt(String(r.institution_contact_encrypted), `app:${r.id}`);
          } catch {
            contact = "";
          }
        }
        return {
          id: Number(r.id),
          requirementId: Number(r.requirement_id),
          requirementTitle: String(r.requirement_title || ""),
          institutionId: String(r.institution_id || ""),
          status,
          normalFileShareId: String(r.normal_file_share_id || ""),
          sbtVerifyTicket: String(r.sbt_verify_ticket || ""),
          reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : "",
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
          contact
        };
      });

      res.json({ ok: true, items });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/share/meta/:share_id", async (req, res) => {
    try {
      const shareId = String(req.params.share_id || "").trim();
      if (!shareId) throw new Error("share_id 不能为空");
      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT share_id, expire_at, max_views, current_views, created_by
           FROM trust_file_shares
           WHERE share_id = ?
           LIMIT 1`,
          [shareId]
        );
        const row = rows?.[0];
        if (!row) throw new Error("分享不存在");
        const maxViews = Number(row.max_views || 0);
        const currentViews = Number(row.current_views || 0);
        return {
          shareId: String(row.share_id || ""),
          createdBy: String(row.created_by || ""),
          expireAt: row.expire_at ? new Date(row.expire_at).toISOString() : "",
          maxViews,
          currentViews,
          remainingViews: Math.max(0, maxViews - currentViews),
          expired: row.expire_at ? Date.now() > new Date(row.expire_at).getTime() : true,
          burned: currentViews >= maxViews
        };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/share/view/:share_id", async (req, res) => {
    try {
      const shareId = String(req.params.share_id || "").trim();
      if (!shareId) throw new Error("share_id 不能为空");

      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT share_id, cid, expire_at, max_views, current_views, created_by
           FROM trust_file_shares
           WHERE share_id = ?
           LIMIT 1 FOR UPDATE`,
          [shareId]
        );
        const row = rows?.[0];
        if (!row) throw new Error("分享不存在");

        const expireAt = new Date(row.expire_at).getTime();
        if (!expireAt || Date.now() > expireAt) throw new Error("链接已焚毁");

        const maxViews = Number(row.max_views || 0);
        const current = Number(row.current_views || 0);
        if (current >= maxViews) throw new Error("链接已焚毁");

        await conn.execute("UPDATE trust_file_shares SET current_views = current_views + 1 WHERE share_id = ?", [shareId]);

        const accessToken = newOpaqueToken(56);
        const accessExpireAt = new Date(Date.now() + 5 * 60 * 1000);
        await conn.execute(
          `INSERT INTO trust_share_access_tokens (token, share_id, cid, expire_at, max_uses, used_times, created_at)
           VALUES (?, ?, ?, ?, 20, 0, NOW())`,
          [accessToken, shareId, String(row.cid || ""), accessExpireAt]
        );

        const tss = new TrustScoreService({ conn });
        await tss.addPoints({
          userAddress: row.created_by,
          delta: 1,
          actionType: "SCORE_FILE_SHARE_VIEWED",
          targetId: shareId,
          actorType: "API",
          actorId: req.ip || ""
        });

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('API', ?, 'SHARE_VIEW', ?, 'SUCCESS')`,
          [req.ip || "", shareId]
        );

        return {
          cid: String(row.cid || ""),
          expireAt: new Date(row.expire_at).toISOString(),
          maxViews,
          currentViews: current + 1,
          accessToken,
          accessExpireAt: accessExpireAt.toISOString()
        };
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(403).json({ ok: false, error: e?.message || String(e) });
    }
  });

  r.get("/share/access/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) throw new Error("token 不能为空");
      const out = await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT token, share_id, cid, expire_at, max_uses, used_times
           FROM trust_share_access_tokens
           WHERE token = ?
           LIMIT 1 FOR UPDATE`,
          [token]
        );
        const row = rows?.[0];
        if (!row) throw new Error("链接不存在");
        const expireAt = new Date(row.expire_at).getTime();
        if (!expireAt || Date.now() > expireAt) throw new Error("链接已失效");
        const maxUses = Number(row.max_uses || 0);
        const used = Number(row.used_times || 0);
        if (used >= maxUses) throw new Error("链接已失效");
        await conn.execute("UPDATE trust_share_access_tokens SET used_times = used_times + 1 WHERE token = ?", [token]);

        await conn.execute(
          `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
           VALUES ('API', ?, 'SHARE_ACCESS', ?, 'SUCCESS')`,
          [req.ip || "", String(row.share_id || "")]
        );

        return {
          cid: String(row.cid || ""),
          expireAt: new Date(row.expire_at).toISOString()
        };
      });
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(403).json({ ok: false, error: e?.message || String(e) });
    }
  });

  return r;
}

module.exports = { trustConnectRouter: router };
