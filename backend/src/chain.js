const { ethers } = require("ethers");
const { optional } = require("./env");

const ISSUER_BATCH_ABI = [
  "event BatchClaimed(bytes32 indexed merkleRoot,address indexed user,uint256 indexed tokenId,string attachmentCID)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)"
];

const CREDENTIAL_CENTER_ABI = [
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)"
];

const USER_SCORE_REGISTRY_ABI = [
  "function setScore(address user,uint256 score) external",
  "function getScore(address user) external view returns (uint256 score,uint256 updatedAt)"
];

function getProvider() {
  const url = optional("CHAIN_RPC_URL", "http://127.0.0.1:8545");
  return new ethers.JsonRpcProvider(url);
}

function getIssuerBatchContract(provider) {
  const addr = optional("ISSUER_BATCH_ADDRESS", "").trim();
  if (!addr) throw new Error("Missing env: ISSUER_BATCH_ADDRESS");
  return new ethers.Contract(ethers.getAddress(addr), ISSUER_BATCH_ABI, provider);
}

function getCredentialCenterContract(provider) {
  const addr = optional("CREDENTIAL_CENTER_ADDRESS", "").trim();
  if (!addr) throw new Error("Missing env: CREDENTIAL_CENTER_ADDRESS");
  return new ethers.Contract(ethers.getAddress(addr), CREDENTIAL_CENTER_ABI, provider);
}

function getScoreRegistryContractWithSigner(provider) {
  const addr = optional("USER_SCORE_REGISTRY_ADDRESS", "").trim();
  if (!addr) throw new Error("Missing env: USER_SCORE_REGISTRY_ADDRESS");
  const pk = optional("SCORE_REGISTRY_OWNER_PRIVATE_KEY", "").trim();
  if (!pk) throw new Error("Missing env: SCORE_REGISTRY_OWNER_PRIVATE_KEY");
  const wallet = new ethers.Wallet(pk, provider);
  return new ethers.Contract(ethers.getAddress(addr), USER_SCORE_REGISTRY_ABI, wallet);
}

module.exports = {
  getProvider,
  getIssuerBatchContract,
  getCredentialCenterContract,
  getScoreRegistryContractWithSigner
};
