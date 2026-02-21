function normalizeRole(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function requireRole(roles) {
  const allowed = new Set((roles || []).map((r) => normalizeRole(r)));
  return function (req, res, next) {
    const role = normalizeRole(req.headers["x-role"] || req.headers["x-actor-role"]);
    const actorId = String(req.headers["x-actor-id"] || req.headers["x-wallet-address"] || "").trim();
    if (!role || !actorId) {
      res.status(401).json({ ok: false, error: "未鉴权：缺少 x-role / x-actor-id" });
      return;
    }
    if (!allowed.has(role)) {
      res.status(403).json({ ok: false, error: "无权限" });
      return;
    }
    req.actor = { role, id: actorId };
    next();
  };
}

function requireApiKey() {
  return function (req, res, next) {
    const expected = String(process.env.TRUSTCONNECT_API_KEY || "").trim();
    const got = String(req.headers["x-api-key"] || "").trim();
    if (!expected) {
      res.status(500).json({ ok: false, error: "服务未配置 TRUSTCONNECT_API_KEY" });
      return;
    }
    if (!got || got !== expected) {
      res.status(401).json({ ok: false, error: "API Key 无效" });
      return;
    }
    req.actor = { role: "API", id: got.slice(0, 8) };
    next();
  };
}

module.exports = {
  requireRole,
  requireApiKey
};

