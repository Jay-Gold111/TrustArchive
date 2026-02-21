const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("AllModule", (m) => {
  const notary = m.contract("Notary");
  const credentialCenter = m.contract("CredentialCenter");
  const archivesRegistry = m.contract("ArchivesRegistry");
  const issuerBatch = m.contract("IssuerBatchSBT", [credentialCenter, archivesRegistry]);
  const scoreRegistry = m.contract("UserScoreRegistry");

  const treasury = m.contract("TrustTreasury");

  m.call(archivesRegistry, "setCredentialCenter", [issuerBatch]);

  return { notary, credentialCenter, archivesRegistry, issuerBatch, scoreRegistry, treasury };
});
