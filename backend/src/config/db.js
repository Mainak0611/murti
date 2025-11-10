import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("Please check your database configuration in .env file");
    console.error("Exiting application...");
    process.exit(1); // Exit the process with failure code
  } else {
    console.log("✅ Connected to MySQL Database");
  }
});

export default db;
