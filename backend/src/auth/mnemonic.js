const crypto = require("crypto");
const ethers = require("ethers");

function generateMnemonic12() {
  try {
    const w = ethers.HDNodeWallet.createRandom();
    const phrase = w?.mnemonic?.phrase;
    if (typeof phrase === "string" && phrase.trim().split(/\s+/g).length === 12) return phrase.trim();
  } catch {
  }
  const entropy = crypto.randomBytes(16);
  if (ethers?.Mnemonic?.entropyToPhrase) return String(ethers.Mnemonic.entropyToPhrase(entropy) || "").trim();
  throw new Error("无法生成助记词：缺少 ethers 助记词能力");
}

module.exports = { generateMnemonic12 };

