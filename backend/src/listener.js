const { ethers } = require("ethers");
const { exec, query } = require("./db");
const { getProvider, getIssuerBatchContract, getCredentialCenterContract } = require("./chain");
const { optionalInt } = require("./env");
const { calculateTrustScore, maybeAnchorToChain } = require("./score");

const STATE_BATCH_ID = "issuer_batch_claimed";
const STATE_CREDENTIAL_ID = "credential_center_mint";

async function getLastBlock(stateId) {
  const rows = await query("SELECT last_block FROM sync_state WHERE id = ?", [stateId]);
  if (!rows || rows.length === 0) return 0;
  return Number(rows[0].last_block || 0);
}

async function setLastBlock(stateId, blockNumber) {
  const n = Number(blockNumber || 0);
  if (!Number.isFinite(n) || n < 0) return;
  await exec(
    "INSERT INTO sync_state (id, last_block) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_block = VALUES(last_block)",
    [stateId, Math.floor(n)]
  );
}

async function incSbtCount(userAddress, delta) {
  const addr = ethers.getAddress(String(userAddress || ""));
  const d = Number(delta || 0);
  await exec(
    `INSERT INTO user_trust_scores (user_address, sbt_count)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE sbt_count = GREATEST(0, sbt_count + VALUES(sbt_count))`,
    [addr, Math.floor(d)]
  );
}

async function recordMintEvent({ source, txHash, logIndex, blockNumber, userAddress }) {
  const src = String(source || "").trim();
  const tx = String(txHash || "").trim();
  const idx = Number(logIndex);
  const bn = Number(blockNumber || 0);
  const addr = ethers.getAddress(String(userAddress || ""));
  if (!src || !tx || !Number.isFinite(idx) || idx < 0) return false;
  const res = await exec(
    `INSERT IGNORE INTO sbt_mint_events (source, tx_hash, log_index, block_number, user_address)
     VALUES (?, ?, ?, ?, ?)`,
    [src, tx, Math.floor(idx), Number.isFinite(bn) ? Math.floor(bn) : 0, addr]
  );
  return Number(res?.affectedRows || 0) > 0;
}

async function syncIssuerBatchOnce() {
  const provider = getProvider();
  const contract = getIssuerBatchContract(provider);

  const latest = await provider.getBlockNumber();
  const stored = await getLastBlock(STATE_BATCH_ID);
  const forcedFrom = optionalInt("SYNC_FROM_BLOCK", 0);
  let fromBlock = stored > 0 ? stored + 1 : forcedFrom > 0 ? forcedFrom : latest;
  if (fromBlock > latest) return;

  const filter = contract.filters.BatchClaimed();
  const logs = await contract.queryFilter(filter, fromBlock, latest);
  for (const ev of logs) {
    const user = ev?.args?.user;
    if (!user) continue;
    const ok = await recordMintEvent({
      source: "issuer_batch",
      txHash: ev?.transactionHash,
      logIndex: ev?.logIndex,
      blockNumber: ev?.blockNumber,
      userAddress: user
    });
    if (!ok) continue;
    await incSbtCount(user, 1);
    const calc = await calculateTrustScore(user);
    if (calc.changed) await maybeAnchorToChain(calc);
  }
  await setLastBlock(STATE_BATCH_ID, latest);
}

async function syncCredentialCenterOnce() {
  const provider = getProvider();
  const contract = getCredentialCenterContract(provider);

  const latest = await provider.getBlockNumber();
  const stored = await getLastBlock(STATE_CREDENTIAL_ID);
  const forcedFrom = optionalInt("CREDENTIAL_SYNC_FROM_BLOCK", 0);
  let fromBlock = stored > 0 ? stored + 1 : forcedFrom > 0 ? forcedFrom : latest;
  if (fromBlock > latest) return;

  const filter = contract.filters.Transfer(ethers.ZeroAddress);
  const logs = await contract.queryFilter(filter, fromBlock, latest);
  for (const ev of logs) {
    const to = ev?.args?.to;
    if (!to) continue;
    const ok = await recordMintEvent({
      source: "credential_center",
      txHash: ev?.transactionHash,
      logIndex: ev?.logIndex,
      blockNumber: ev?.blockNumber,
      userAddress: to
    });
    if (!ok) continue;
    await incSbtCount(to, 1);
    const calc = await calculateTrustScore(to);
    if (calc.changed) await maybeAnchorToChain(calc);
  }
  await setLastBlock(STATE_CREDENTIAL_ID, latest);
}

async function startListener() {
  await setLastBlock(STATE_BATCH_ID, await getLastBlock(STATE_BATCH_ID));
  await setLastBlock(STATE_CREDENTIAL_ID, await getLastBlock(STATE_CREDENTIAL_ID));
  await syncIssuerBatchOnce();
  await syncCredentialCenterOnce();
  const timer = setInterval(() => {
    syncIssuerBatchOnce().catch(() => {});
    syncCredentialCenterOnce().catch(() => {});
  }, 15_000);
  return () => clearInterval(timer);
}

module.exports = {
  startListener,
  syncOnce: async () => {
    await syncIssuerBatchOnce();
    await syncCredentialCenterOnce();
  }
};
