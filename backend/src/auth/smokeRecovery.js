const crypto = require("crypto");
const {
  decryptAes256Gcm,
  deriveKeyFromPassword,
  deriveRecoveryKeyFromMnemonic,
  encryptAes256Gcm,
  newSaltB64
} = require("./recoveryCrypto");
const { generateMnemonic12 } = require("./mnemonic");

function mustThrow(fn, label) {
  try {
    fn();
  } catch (e) {
    process.stdout.write(`[ok] ${label}: ${String(e?.message || e)}\n`);
    return;
  }
  throw new Error(`[fail] ${label}: expected throw`);
}

async function main() {
  const masterKey = crypto.randomBytes(32);
  const masterKeyB64 = masterKey.toString("base64");
  const wallet = "0x000000000000000000000000000000000000dEaD";

  const pwSalt = newSaltB64(16);
  const pwKey = deriveKeyFromPassword({ password: "pw123", saltB64: pwSalt, iterations: 120000 });
  const pwEnvelope = encryptAes256Gcm({ key: pwKey, plainText: masterKeyB64, aad: `pw:${wallet}` });

  mustThrow(
    () => decryptAes256Gcm({ key: deriveKeyFromPassword({ password: "wrong", saltB64: pwSalt, iterations: 120000 }), envelope: pwEnvelope, aad: `pw:${wallet}` }),
    "wrong password should fail at decipher.final"
  );

  const phrase = generateMnemonic12();
  const recSalt = newSaltB64(16);
  const recKey = deriveRecoveryKeyFromMnemonic({ mnemonicWordsOrPhrase: phrase, saltB64: recSalt, iterations: 120000 });
  const recEnvelope = encryptAes256Gcm({ key: recKey, plainText: masterKeyB64, aad: `recovery:${wallet}` });

  mustThrow(
    () => decryptAes256Gcm({ key: deriveRecoveryKeyFromMnemonic({ mnemonicWordsOrPhrase: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", saltB64: recSalt, iterations: 120000 }), envelope: recEnvelope, aad: `recovery:${wallet}` }),
    "wrong mnemonic should fail at decipher.final"
  );

  const ok = decryptAes256Gcm({ key: recKey, envelope: recEnvelope, aad: `recovery:${wallet}` });
  if (ok !== masterKeyB64) throw new Error("decrypt mismatch");
  process.stdout.write("[ok] decrypt success\n");
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});

