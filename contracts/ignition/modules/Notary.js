const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NotaryModule", (m) => {
  const notary = m.contract("Notary");
  return { notary };
});

