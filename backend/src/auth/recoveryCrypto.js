const crypto = require("crypto");

function normalizeMnemonic(wordsOrPhrase) {
  if (Array.isArray(wordsOrPhrase)) {
    return wordsOrPhrase.map((w) => String(w || "").trim()).filter(Boolean).join(" ").trim().toLowerCase();
  }
  return String(wordsOrPhrase || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function encodeEnvelope({ iv, ciphertext, authTag }) {
  return `${Buffer.from(iv).toString("base64")}:${Buffer.from(ciphertext).toString("base64")}:${Buffer.from(authTag).toString("base64")}`;
}

function decodeEnvelope(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("envelope 为空");
  const parts = raw.split(":");
  if (parts.length === 4 && parts[0] === "v1") {
    const iv = Buffer.from(parts[1], "base64");
    const authTag = Buffer.from(parts[2], "base64");
    const ciphertext = Buffer.from(parts[3], "base64");
    return { iv, ciphertext, authTag };
  }
  if (parts.length !== 3) throw new Error("envelope 格式无效");
  const iv = Buffer.from(parts[0], "base64");
  const ciphertext = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");
  return { iv, ciphertext, authTag };
}

function encryptAes256Gcm({ key, plainText, aad }) {
  const k = Buffer.isBuffer(key) ? key : Buffer.from(key || []);
  if (k.length !== 32) throw new Error("key 长度必须为 32 bytes");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  if (aad != null) cipher.setAAD(Buffer.from(String(aad)));
  const ct = Buffer.concat([cipher.update(Buffer.from(String(plainText), "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return encodeEnvelope({ iv, ciphertext: ct, authTag: tag });
}

function decryptAes256Gcm({ key, envelope, aad }) {
  const k = Buffer.isBuffer(key) ? key : Buffer.from(key || []);
  if (k.length !== 32) throw new Error("key 长度必须为 32 bytes");
  const { iv, ciphertext, authTag } = decodeEnvelope(envelope);
  const decipher = crypto.createDecipheriv("aes-256-gcm", k, iv);
  if (aad != null) decipher.setAAD(Buffer.from(String(aad)));
  decipher.setAuthTag(authTag);
  const pt = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return pt.toString("utf8");
}

function deriveKeyFromPassword({ password, saltB64, iterations }) {
  const p = String(password || "");
  const salt = Buffer.from(String(saltB64 || ""), "base64");
  const it = Math.max(1, Math.floor(Number(iterations || 120000)));
  if (!p) throw new Error("password 不能为空");
  if (!salt.length) throw new Error("salt 不能为空");
  return crypto.pbkdf2Sync(p, salt, it, 32, "sha256");
}

function deriveRecoveryKeyFromMnemonic({ mnemonicWordsOrPhrase, saltB64, iterations }) {
  const phrase = normalizeMnemonic(mnemonicWordsOrPhrase);
  const salt = Buffer.from(String(saltB64 || ""), "base64");
  const it = Math.max(1, Math.floor(Number(iterations || 120000)));
  if (!phrase) throw new Error("mnemonic 不能为空");
  if (!salt.length) throw new Error("recovery_salt 不能为空");
  return crypto.pbkdf2Sync(phrase, salt, it, 32, "sha256");
}

function newSaltB64(bytes = 16) {
  return crypto.randomBytes(Math.max(8, Math.min(64, Number(bytes || 16)))).toString("base64");
}

module.exports = {
  normalizeMnemonic,
  encryptAes256Gcm,
  decryptAes256Gcm,
  deriveKeyFromPassword,
  deriveRecoveryKeyFromMnemonic,
  newSaltB64
};

