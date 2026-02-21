const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

/**
 * Hardhat Ignition 部署模块
 *
 * 部署命令（在 contracts 目录）：
 *   npm run deploy:localhost
 *
 * 成功后会在 ignition/deployments 下生成部署记录，可用于前端读取合约地址。
 */
module.exports = buildModule("SafetyEvidenceModule", (m) => {
  const safetyEvidence = m.contract("SafetyEvidence");
  return { safetyEvidence };
});

