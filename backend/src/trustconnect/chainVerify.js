const { ethers } = require("ethers");
const { getProvider, getIssuerBatchContract, getCredentialCenterContract } = require("../chain");

async function verifySbtOwnership({ userAddress, tokenId, contract }) {
  const provider = getProvider();
  const user = ethers.getAddress(String(userAddress || ""));
  const id = String(tokenId || "").trim();
  if (!id) throw new Error("缺少 sbt_token_id");

  let c = null;
  const kind = String(contract || "").trim().toLowerCase();
  if (kind === "credential_center") c = getCredentialCenterContract(provider);
  else c = getIssuerBatchContract(provider);

  const owner = await c.ownerOf(id);
  const ok = ethers.getAddress(owner) === user;
  return { ok, owner: ethers.getAddress(owner), user, tokenId: id, contract: kind || "issuer_batch" };
}

module.exports = { verifySbtOwnership };

