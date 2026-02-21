function apiBase() {
  const v = import.meta.env.VITE_TRUST_SCORE_API;
  return typeof v === "string" ? v.replace(/\/+$/, "") : "";
}

async function getTrustScore(address) {
  const base = apiBase();
  if (!base) throw new Error("未配置 VITE_TRUST_SCORE_API");
  const addr = String(address || "").trim();
  if (!addr) throw new Error("缺少 address");
  const res = await fetch(`${base}/api/trust-score/${encodeURIComponent(addr)}?sync=1&refresh=1`, { method: "GET" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || `请求失败（${res.status}）`);
  return json;
}

async function logSafeLinkCreated({ userAddress, cid, expiresAt }) {
  const base = apiBase();
  if (!base) return false;
  const res = await fetch(`${base}/api/share/safe-link/created`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userAddress, cid, expiresAt })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) return false;
  return true;
}

export { getTrustScore, logSafeLinkCreated };
