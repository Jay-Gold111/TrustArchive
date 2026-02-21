const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("IssuerSuiteModule", (m) => {
  const credentialCenter = m.contract("CredentialCenter");
  const archivesRegistry = m.contract("ArchivesRegistry");

  m.call(credentialCenter, "setArchivesRegistry", [archivesRegistry]);
  m.call(archivesRegistry, "setCredentialCenter", [credentialCenter]);

  return { credentialCenter, archivesRegistry };
});

