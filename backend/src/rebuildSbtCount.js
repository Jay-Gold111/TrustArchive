const { loadEnv } = require("./loadEnv");
loadEnv();

const { exec } = require("./db");
const { ensureSchema } = require("./schema");
const { syncOnce } = require("./listener");
const { runFullRecalc } = require("./score");

async function rebuild() {
  await ensureSchema();

  const forceBatch = process.env.SYNC_FROM_BLOCK;
  const forceCred = process.env.CREDENTIAL_SYNC_FROM_BLOCK;
  if (!forceBatch) process.env.SYNC_FROM_BLOCK = "1";
  if (!forceCred) process.env.CREDENTIAL_SYNC_FROM_BLOCK = "1";

  await exec("DELETE FROM sbt_mint_events", []);
  await exec("UPDATE user_trust_scores SET sbt_count = 0", []);
  await exec("DELETE FROM sync_state WHERE id IN ('issuer_batch_claimed','credential_center_mint')", []);

  await syncOnce();
  await runFullRecalc();
}

rebuild()
  .then(() => {
    process.stdout.write("Rebuild complete\n");
    process.exit(0);
  })
  .catch((e) => {
    process.stderr.write(`${e?.stack || e}\n`);
    process.exit(1);
  });

