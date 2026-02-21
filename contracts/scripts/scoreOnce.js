const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

function readDeployedAddress(deploymentId, key) {
  try {
    const p = path.join(__dirname, "..", "ignition", "deployments", deploymentId, "deployed_addresses.json");
    const json = JSON.parse(fs.readFileSync(p, "utf8"));
    return json?.[key] || "";
  } catch {
    return "";
  }
}

async function main() {
  const credential =
    process.env.CREDENTIAL_CENTER_ADDRESS ||
    readDeployedAddress("chain-1337-issuer-v1", "CredentialCenterModule#CredentialCenter");
  const registry =
    process.env.SCORE_REGISTRY_ADDRESS ||
    readDeployedAddress("chain-1337-score-v1", "UserScoreRegistryModule#UserScoreRegistry");

  if (!credential) throw new Error("Missing CREDENTIAL_CENTER_ADDRESS");
  if (!registry) throw new Error("Missing SCORE_REGISTRY_ADDRESS");

  const [signer] = await ethers.getSigners();
  const CredentialCenter = await ethers.getContractFactory("CredentialCenter");
  const UserScoreRegistry = await ethers.getContractFactory("UserScoreRegistry");

  const cred = CredentialCenter.attach(credential).connect(signer);
  const reg = UserScoreRegistry.attach(registry).connect(signer);

  const provider = signer.provider;
  const accounts = await provider.listAccounts();

  console.log("CredentialCenter:", credential);
  console.log("UserScoreRegistry:", registry);
  console.log("Accounts:", accounts.length);

  for (const a of accounts) {
    const res = await cred.getTokensOf(a);
    const ids = res?.[0] || [];
    const n = Number(ids.length || 0);
    const score = Math.min(100, n * 20);
    const tx = await reg.setScore(a, score);
    await tx.wait();
    console.log(a, "tokens=", n, "score=", score);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

