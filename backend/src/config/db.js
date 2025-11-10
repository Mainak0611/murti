// backend/src/config/db.js
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.PG_CONNECTION_STRING;

if (!connectionString) {
  console.error("❌ Missing PG_CONNECTION_STRING in environment. Set PG_CONNECTION_STRING in your .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  // Supabase requires SSL; set rejectUnauthorized false so hosted certs work
  ssl: { rejectUnauthorized: false },
  // optional tuning:
  max: 10,          // max connections in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// test connection at startup and exit process on failure (like your MySQL version)
(async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1"); // simple smoke test
    client.release();
    console.log("✅ Connected to Supabase Postgres (PG) via pool");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("Please check your PG_CONNECTION_STRING (.env) and network/firewall settings");
    // close pool then exit
    try { await pool.end(); } catch (e) {}
    process.exit(1);
  }
})();

export default pool;
