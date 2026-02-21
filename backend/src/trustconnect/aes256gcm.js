const crypto = require("crypto");

function getKey() {
  const b64 = String(process.env.TRUSTCONNECT_AES_KEY_B64 || "").trim();
  if (b64) {
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) throw new Error("TRUSTCONNECT_AES_KEY_B64 必须是 32 字节的 base64");
    return key;
  }
  const hex = String(process.env.TRUSTCONNECT_AES_KEY_HEX || "").trim();
  if (hex) {
    const key = Buffer.from(hex, "hex");
    if (key.length !== 32) throw new Error("TRUSTCONNECT_AES_KEY_HEX 必须是 32 字节的 hex");
    return key;
  }
  throw new Error("缺少 TRUSTCONNECT_AES_KEY_B64/TRUSTCONNECT_AES_KEY_HEX");
}

function encrypt(plainText, aad = "") {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(String(aad)));
  const ciphertext = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

function decrypt(payload, aad = "") {
  const key = getKey();
  const p = String(payload || "");
  const parts = p.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("密文格式不正确");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  if (aad) decipher.setAAD(Buffer.from(String(aad)));
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

module.exports = { encrypt, decrypt };

