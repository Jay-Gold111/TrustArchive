const mysql = require("mysql2/promise");
const { optional, optionalInt } = require("./env");

let pool = null;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: optional("MYSQL_HOST", "127.0.0.1"),
    port: optionalInt("MYSQL_PORT", 3306),
    user: optional("MYSQL_USER", "root"),
    password: optional("MYSQL_PASSWORD", ""),
    database: optional("MYSQL_DATABASE", "trust_archive"),
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function exec(sql, params = []) {
  const [res] = await getPool().execute(sql, params);
  return res;
}

async function ping() {
  const pool = getPool();
  await pool.query("SELECT 1");
  return true;
}

module.exports = {
  getPool,
  query,
  exec,
  ping
};
