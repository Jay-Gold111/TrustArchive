const { loadEnv } = require("./loadEnv");
loadEnv();

const { ensureSchema } = require("./schema");

ensureSchema()
  .then(() => {
    process.stdout.write("Migration complete\n");
    process.exit(0);
  })
  .catch((e) => {
    process.stderr.write(`${e?.stack || e}\n`);
    process.exit(1);
  });
