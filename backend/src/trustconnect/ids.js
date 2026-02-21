const crypto = require("crypto");

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomBase62(len) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function newShareId() {
  return randomBase62(12);
}

function newTicket() {
  return randomBase62(48);
}

module.exports = { newShareId, newTicket };

