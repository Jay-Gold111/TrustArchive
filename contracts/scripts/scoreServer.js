const http = require("http");
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

async function computeAndSync() {
  const credential =
    process.env.CREDENTIAL_CENTER_ADDRESS ||
    readDeployedAddress("chain-1337-issuer-v1", "CredentialCenterModule#CredentialCenter");
  const registry =
    process.env.SCORE_REGISTRY_ADDRESS ||
    readDeployedAddress("chain-1337-score-v1", "UserScoreRegistryModule#UserScoreRegistry");
  if (!credential || !registry) throw new Error("Missing contract addresses");

  const [signer] = await ethers.getSigners();
  const CredentialCenter = await ethers.getContractFactory("CredentialCenter");
  const UserScoreRegistry = await ethers.getContractFactory("UserScoreRegistry");
  const cred = CredentialCenter.attach(credential).connect(signer);
  const reg = UserScoreRegistry.attach(registry).connect(signer);

  const provider = signer.provider;
  const accounts = await provider.listAccounts();
  for (const a of accounts) {
    const res = await cred.getTokensOf(a);
    const ids = res?.[0] || [];
    const n = Number(ids.length || 0);
    const score = Math.min(100, n * 20);
    await (await reg.setScore(a, score)).wait();
  }
  return { credential, registry, accounts: accounts.length, at: Date.now() };
}

async function main() {
  let last = null;
  let lastErr = null;

  async function tick() {
    try {
      lastErr = null;
      last = await computeAndSync();
      // eslint-disable-next-line no-console
      console.log("score synced", last);
    } catch (e) {
      lastErr = String(e?.message || e);
      // eslint-disable-next-line no-console
      console.error("score sync failed:", lastErr);
    }
  }

  await tick();
  setInterval(tick, 60 * 1000);

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(lastErr ? 500 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: !lastErr, last, error: lastErr }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  const port = Number(process.env.PORT || 8787);
  server.listen(port, "127.0.0.1", () => {
    // eslint-disable-next-line no-console
    console.log(`credit engine running on http://127.0.0.1:${port}/health`);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

