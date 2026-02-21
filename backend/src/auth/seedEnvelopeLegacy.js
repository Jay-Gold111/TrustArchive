const crypto = require("crypto");

function openSeedEnvelopeLegacy({ personalPassword, envelope }) {
  const pwd = typeof personalPassword === "string" ? personalPassword : "";
  if (!pwd) throw new Error("个人密码不能为空");
  if (!envelope || typeof envelope !== "object") throw new Error("缺少种子信封");

  const iterations = Number(envelope.iterations) || 0;
  const saltHex = String(envelope.saltHex || "");
  const ivHex = String(envelope.ivHex || "");
  const ciphertextB64 = String(envelope.ciphertext || "");
  if (!iterations || !saltHex || !ivHex || !ciphertextB64) throw new Error("种子信封格式无效");

  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  if (salt.length !== 16) throw new Error("种子信封 salt 无效");
  if (iv.length !== 16) throw new Error("种子信封 iv 无效");

  const key = crypto.pbkdf2Sync(pwd, salt, iterations, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8").trim();

  if (!/^[0-9a-f]{64}$/i.test(plain)) {
    const e = new Error("Incorrect Password");
    e.statusCode = 401;
    throw e;
  }
  return plain.toLowerCase();
}

module.exports = { openSeedEnvelopeLegacy };

