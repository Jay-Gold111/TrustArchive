function apiBase() {
  const v = import.meta.env.VITE_TRUST_SCORE_API;
  return typeof v === "string" ? v.replace(/\/+$/, "") : "";
}

function authHeaders({ role, actorId, apiKey } = {}) {
  const h = { "Content-Type": "application/json" };
  if (role) h["x-role"] = String(role);
  if (actorId) h["x-actor-id"] = String(actorId);
  if (apiKey) h["x-api-key"] = String(apiKey);
  return h;
}

async function requestJson(path, { method = "GET", body, headers } = {}) {
  const base = apiBase();
  if (!base) throw new Error("未配置 VITE_TRUST_SCORE_API");
  const res = await fetch(`${base}${path}`, {
    method,
    headers: headers || undefined,
    body: body != null ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    if (res.status === 404) {
      const err = new Error(
        "接口不存在（404）：请确认 backend 已重启到最新代码，且 VITE_TRUST_SCORE_API 指向实际运行端口。"
      );
      err.statusCode = 404;
      throw err;
    }
    const err = new Error(json?.error || `请求失败（${res.status}）`);
    err.statusCode = res.status;
    throw err;
  }
  return json;
}

export async function listRequirements() {
  return await requestJson("/api/connect/requirements?status=OPEN", { method: "GET" });
}

export async function getRequirement(id) {
  return await requestJson(`/api/connect/requirements/${encodeURIComponent(String(id))}`, { method: "GET" });
}

export async function applyToRequirement(payload, { role, actorId } = {}) {
  return await requestJson("/api/connect/apply", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: payload
  });
}

export async function consumeUploadFee(requirementId, actionId, { role, actorId } = {}) {
  return await requestJson("/api/connect/billing/upload", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { requirement_id: Number(requirementId || 0), action_id: String(actionId || "") }
  });
}

export async function refundUploadFee(actionId, { role, actorId } = {}) {
  return await requestJson("/api/connect/billing/upload-refund", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { action_id: String(actionId || "") }
  });
}

export async function consumeReviewOpenFee(applicationId, { role, actorId } = {}) {
  return await requestJson("/api/connect/billing/review-open", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { application_id: Number(applicationId || 0) }
  });
}

export async function getWalletBalance({ role, actorId } = {}) {
  return await requestJson("/api/connect/billing/balance", {
    method: "GET",
    headers: authHeaders({ role, actorId })
  });
}

export async function getPlatformRevenue({ role, actorId } = {}) {
  return await requestJson("/api/connect/billing/revenue", {
    method: "GET",
    headers: authHeaders({ role, actorId })
  });
}

export async function markRevenueWithdraw(amount, { role, actorId } = {}) {
  return await requestJson("/api/connect/billing/revenue/withdraw", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { amount: Number(amount || 0) }
  });
}

export async function confirmRecharge(txHash, { role, actorId } = {}) {
  return await requestJson("/api/connect/billing/recharge/confirm", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { tx_hash: String(txHash || "") }
  });
}

export async function mnemonicSetup(currentPassword, { role, actorId } = {}) {
  return await requestJson("/api/auth/mnemonic/setup", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { current_password: String(currentPassword || "") }
  });
}

export async function mnemonicView(currentPassword, { role, actorId } = {}) {
  return await requestJson("/api/auth/mnemonic/view", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { current_password: String(currentPassword || "") }
  });
}

export async function recoverPassword({ mnemonic, newPassword }, { role, actorId } = {}) {
  const words = Array.isArray(mnemonic) ? mnemonic : String(mnemonic || "");
  return await requestJson("/api/auth/password/recover", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { mnemonic: words, new_password: String(newPassword || "") }
  });
}

export async function listMyRequirements({ role, actorId } = {}) {
  return await requestJson("/api/connect/manage/requirements", {
    method: "GET",
    headers: authHeaders({ role, actorId })
  });
}

export async function createRequirement(payload, { role, actorId } = {}) {
  return await requestJson("/api/connect/requirements", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: payload
  });
}

export async function updateRequirement(id, payload, { role, actorId } = {}) {
  return await requestJson(`/api/connect/requirements/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    headers: authHeaders({ role, actorId }),
    body: payload
  });
}

export async function deleteRequirement(id, { role, actorId } = {}) {
  return await requestJson(`/api/connect/requirements/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    headers: authHeaders({ role, actorId })
  });
}

export async function batchDeleteRequirements(ids, { role, actorId } = {}) {
  return await requestJson("/api/connect/requirements/batch-delete", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: { ids }
  });
}

export async function listApplications(requirementId, { role, actorId } = {}) {
  return await requestJson(`/api/connect/manage/applications?requirement_id=${encodeURIComponent(String(requirementId))}`, {
    method: "GET",
    headers: authHeaders({ role, actorId })
  });
}

export async function getApplicationTrustScore(applicationId, { role, actorId } = {}) {
  return await requestJson(`/api/connect/manage/applications/${encodeURIComponent(String(applicationId))}/score`, {
    method: "GET",
    headers: authHeaders({ role, actorId })
  });
}

export async function listMyApplications({ role, actorId } = {}) {
  return await requestJson("/api/connect/my/applications", {
    method: "GET",
    headers: authHeaders({ role, actorId })
  });
}

export async function reviewApplication(payload, { role, actorId } = {}) {
  return await requestJson("/api/connect/review", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: payload
  });
}

export async function verifySbtTicket(payload, { role, actorId } = {}) {
  return await requestJson("/api/connect/verify/sbt", {
    method: "POST",
    headers: authHeaders({ role, actorId }),
    body: payload
  });
}

export async function getShareMeta(shareId) {
  return await requestJson(`/api/share/meta/${encodeURIComponent(String(shareId))}`, { method: "GET" });
}

export async function viewShare(shareId) {
  return await requestJson(`/api/share/view/${encodeURIComponent(String(shareId))}`, { method: "GET" });
}

export async function accessShareToken(token) {
  return await requestJson(`/api/share/access/${encodeURIComponent(String(token))}`, { method: "GET" });
}
