const { ethers } = require("ethers");

class TrustScoreService {
  constructor({ conn }) {
    this.conn = conn;
  }

  async ensureUserRow(userAddress) {
    const addr = ethers.getAddress(String(userAddress || ""));
    await this.conn.execute(
      "INSERT INTO user_trust_scores (user_address) VALUES (?) ON DUPLICATE KEY UPDATE user_address = user_address",
      [addr]
    );
    return addr;
  }

  async addPoints({ userAddress, delta, actionType, targetId, actorType, actorId }) {
    const addr = await this.ensureUserRow(userAddress);
    const d = Number(delta || 0);
    if (!Number.isFinite(d) || d === 0) return addr;

    await this.conn.execute("UPDATE user_trust_scores SET bonus_score = bonus_score + ? WHERE user_address = ?", [d, addr]);

    await this.conn.execute(
      `INSERT INTO trust_audit_logs (actor_type, actor_id, action_type, target_id, result)
       VALUES (?, ?, ?, ?, 'SUCCESS')`,
      [String(actorType || "API"), String(actorId || ""), String(actionType || "SCORE_ADD"), String(targetId || "")]
    );
    return addr;
  }
}

module.exports = { TrustScoreService };

