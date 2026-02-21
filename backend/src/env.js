function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function optional(name, fallback = "") {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return v;
}

function optionalInt(name, fallback) {
  const v = optional(name, "");
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

module.exports = {
  required,
  optional,
  optionalInt
};

