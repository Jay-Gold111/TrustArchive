const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("CredentialCenterModule", (m) => {
  const credentialCenter = m.contract("CredentialCenter");
  return { credentialCenter };
});

