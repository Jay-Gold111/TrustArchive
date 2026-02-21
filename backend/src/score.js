const { ethers } = require("ethers");
const cron = require("node-cron");
const { exec, query } = require("./db");
const { getProvider, getScoreRegistryContractWithSigner } = require("./chain");

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function computeTrustLevel(totalScore) {
  const s = Number(totalScore || 0);
  if (s >= 90) return "S";
  if (s >= 80) return "A";
  if (s >= 60) return "B";
  return "C";
}

async function getFirstActivityAtMs(addr) {
  const candidates = [];
  try {
    const a = await query("SELECT MIN(created_at) AS t FROM trust_applications WHERE user_address = ?", [addr]);
    const t = a?.[0]?.t ? new Date(a[0].t).getTime() : 0;
    if (Number.isFinite(t) && t > 0) candidates.push(t);
  } catch {
  }
  try {
    const a = await query("SELECT MIN(created_at) AS t FROM trust_verify_tickets WHERE user_address = ?", [addr]);
    const t = a?.[0]?.t ? new Date(a[0].t).getTime() : 0;
    if (Number.isFinite(t) && t > 0) candidates.push(t);
  } catch {
  }
  try {
    const a = await query("SELECT MIN(created_at) AS t FROM trust_file_shares WHERE created_by = ?", [addr]);
    const t = a?.[0]?.t ? new Date(a[0].t).getTime() : 0;
    if (Number.isFinite(t) && t > 0) candidates.push(t);
  } catch {
  }
  if (!candidates.length) return 0;
  return Math.min(...candidates);
}

async function refreshShareHealthRate(userAddress) {
  const addr = ethers.getAddress(String(userAddress || ""));
  const now = Date.now();
  const totalRows = await query("SELECT COUNT(*) AS c FROM safe_link_creations WHERE user_address = ?", [addr]);
  const total = Number(totalRows?.[0]?.c || 0);
  const expiredRows = await query(
    `SELECT COUNT(*) AS c
     FROM safe_link_creations c
     WHERE c.user_address = ?
       AND c.expires_at < ?
       AND NOT EXISTS (
         SELECT 1 FROM verification_logs v
         WHERE v.cid = c.cid AND v.is_success = 1
       )`,
    [addr, now]
  );
  const expired = Number(expiredRows?.[0]?.c || 0);
  const healthRate = total > 0 ? clamp((total - expired) / total, 0, 1) : 1;
  await exec(
    `INSERT INTO share_health_rate (user_address, total_links, expired_links, health_rate)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE total_links = VALUES(total_links), expired_links = VALUES(expired_links), health_rate = VALUES(health_rate)`,
    [addr, total, expired, healthRate]
  );
  return { total, expired, healthRate };
}

async function calculateTrustScore(userAddress) {
  const addr = ethers.getAddress(String(userAddress || ""));
  await exec("INSERT INTO user_trust_scores (user_address) VALUES (?) ON DUPLICATE KEY UPDATE user_address = user_address", [addr]);

  const scoreRow = await query("SELECT sbt_count, trust_level FROM user_trust_scores WHERE user_address = ?", [addr]);
  const sbtCount = Number(scoreRow?.[0]?.sbt_count || 0);
  const prevLevel = String(scoreRow?.[0]?.trust_level || "C");

  const rawBaseScore = Math.max(0, sbtCount * 4);
  const baseScore = Math.min(rawBaseScore, 40);

  const passedRows = await query("SELECT COUNT(*) AS c FROM trust_applications WHERE user_address = ? AND status = 'PASSED'", [addr]);
  const passedCount = Number(passedRows?.[0]?.c || 0);

  const verifyRows = await query("SELECT SUM(used_times) AS c FROM trust_verify_tickets WHERE user_address = ?", [addr]);
  const verifyCount = Number(verifyRows?.[0]?.c || 0);

  const shareRows = await query("SELECT SUM(current_views) AS c FROM trust_file_shares WHERE created_by = ?", [addr]);
  const shareViewCount = Number(shareRows?.[0]?.c || 0);

  const rawBehaviorScore = Math.max(0, passedCount * 5 + verifyCount * 3 + shareViewCount * 1);
  const behaviorScore = Math.min(rawBehaviorScore, 30);

  const firstAtMs = await getFirstActivityAtMs(addr);
  const nowMs = Date.now();
  const daysActive = firstAtMs ? Math.max(0, Math.floor((nowMs - firstAtMs) / (24 * 60 * 60 * 1000))) : 0;
  const dayScore = daysActive * 0.5;
  const weekScore = Math.floor(daysActive / 7) * 3;
  const rawStability = Math.max(0, Math.max(dayScore, weekScore));
  const stabilityScore = Math.min(rawStability, 20);

  const rejectedRows = await query("SELECT COUNT(*) AS c FROM trust_applications WHERE user_address = ? AND status = 'REJECTED'", [addr]);
  const rejectedCount = Number(rejectedRows?.[0]?.c || 0);
  const rawRiskPenalty = Math.max(0, rejectedCount * 2);
  const riskPenalty = Math.min(rawRiskPenalty, 10);

  const rawTotal = baseScore + behaviorScore + stabilityScore - riskPenalty;
  const totalScore = Math.max(0, Math.min(rawTotal, 100));
  const trustLevel = computeTrustLevel(totalScore);

  await exec(
    `UPDATE user_trust_scores
     SET sbt_count = ?, base_score = ?, behavior_score = ?, stability_score = ?, risk_penalty = ?, bonus_score = 0, total_score = ?, trust_level = ?
     WHERE user_address = ?`,
    [sbtCount, baseScore, behaviorScore, stabilityScore, riskPenalty, totalScore, trustLevel, addr]
  );

  const changed = prevLevel !== trustLevel;
  return {
    userAddress: addr,
    baseScore,
    behaviorScore,
    stabilityScore,
    riskPenalty,
    totalScore,
    trustLevel,
    changed
  };
}

async function maybeAnchorToChain(result) {
  if (!result?.changed) return null;
  const addrEnv = String(process.env.USER_SCORE_REGISTRY_ADDRESS || "").trim();
  const pkEnv = String(process.env.SCORE_REGISTRY_OWNER_PRIVATE_KEY || "").trim();
  if (!addrEnv || !pkEnv) return null;
  const provider = getProvider();
  const contract = getScoreRegistryContractWithSigner(provider);
  const addr = ethers.getAddress(result.userAddress);
  const level = String(result.trustLevel || "C");
  const scoreScaled = Math.round(Number(result.totalScore || 0) * 100);
  const hashHex = ethers.keccak256(
    ethers.toUtf8Bytes(`TA_TRUST_LEVEL_V1|${addr.toLowerCase()}|${level}|${scoreScaled}`)
  );
  const value = BigInt(hashHex);
  const tx = await contract.setScore(addr, value);
  const receipt = await tx.wait();
  await exec(
    `UPDATE user_trust_scores
     SET onchain_level = ?, onchain_value = ?, onchain_updated_at = NOW()
     WHERE user_address = ?`,
    [level, hashHex, addr]
  );
  return { txHash: receipt?.hash || tx.hash, hash: hashHex };
}

async function runFullRecalc() {
  const rows = await query("SELECT user_address FROM user_trust_scores", []);
  const list = (rows || []).map((r) => String(r.user_address || "")).filter(Boolean);
  for (const addr of list) {
    const res = await calculateTrustScore(addr);
    if (res.changed) {
      await maybeAnchorToChain(res);
    }
  }
  return list.length;
}

function startCron() {
  const job = cron.schedule("0 3 * * *", () => {
    runFullRecalc().catch(() => {});
  });
  job.start();
  return () => job.stop();
}

module.exports = {
  calculateTrustScore,
  calculateUserScore: calculateTrustScore,
  maybeAnchorToChain,
  runFullRecalc,
  startCron,
  computeTrustLevel
};
