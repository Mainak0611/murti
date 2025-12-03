// backend/src/config/db.js
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

// --- FIX START: PREVENT DATE TIMEZONE CONVERSION ---
// OID 1082 is the Postgres internal ID for the 'DATE' type.
// We override the parser to return the raw string (e.g., "2025-12-31")
// instead of converting it to a Date object (which causes the -1 day issue).
pkg.types.setTypeParser(1082, (stringValue) => {
  return stringValue; 
});
// --- FIX END ---

const connectionString = process.env.PG_CONNECTION_STRING;

if (!connectionString) {
  console.error("❌ Missing PG_CONNECTION_STRING in environment. Set PG_CONNECTION_STRING in your environment variables.");
  process.exit(1);
}

// helper: mask password when printing the connection info
const maskConn = (uri) => {
  try {
    // eslint-disable-next-line no-unused-vars
    const u = new URL(uri.replace(/^postgres:/, "http:")); // use URL parser (hack)
    u.password = "*****";
    return `${u.protocol}//${u.username}:*****@${u.hostname}:${u.port}${u.pathname}`;
  } catch (e) {
    return uri.replace(/:(\/\/.*@).*/, ":$1*****@*****");
  }
};

console.log("🔍 PG connection info (masked):", maskConn(connectionString));

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // required for Supabase hosted certs
  max: 20,                               // increase pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,        // raise timeout so transient network latency won't fail immediately
});

pool.on("error", (err, client) => {
  console.error("⚠️ Unexpected PG idle client error", err && err.stack ? err.stack : err);
});

// small helper that tries acquiring a client with better error output
const testConnection = async () => {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT version() as ver");
      console.log("✅ PG test OK:", res.rows[0].ver);
    } finally {
      client.release();
    }
  } catch (err) {
    // print full error stack to logs
    console.error("❌ Database connection failed:", err && err.stack ? err.stack : err);
    console.error("Please check your PG_CONNECTION_STRING and that the connection string uses the pooler (.pooler.) with port 6543 when running from Render.");
    try { await pool.end(); } catch (e) {}
    process.exit(1);
  }
};

// run a single test at startup
testConnection();

export default pool;