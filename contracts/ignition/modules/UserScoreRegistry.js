const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UserScoreRegistryModule", (m) => {
  const registry = m.contract("UserScoreRegistry");
  return { registry };
});

