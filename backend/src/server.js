import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import registerRoutes from "./routes.js";

dotenv.config();

const app = express();

const rawAllowed = process.env.ALLOWED_ORIGINS || "http://localhost:5173";
const allowedOrigins = rawAllowed
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// 1. Apply CORS middleware globally
app.use(cors(corsOptions));

// 2. Explicitly handle Preflight (OPTIONS) requests
// FIX: Changed "*" to /(.*)/ to prevent "Missing parameter name" crash
app.options(/(.*)/, cors(corsOptions));

// Body parser
app.use(express.json());

// ----------------------------------------------
// REGISTER ROUTES
// ----------------------------------------------
registerRoutes(app);

// Simple health check
app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));

// Fallback root
app.get("/", (req, res) => res.send("Backend server is running."));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && (err.stack || err.message || err));
  if (err && err.message && err.message.toLowerCase().includes("cors")) {
    return res.status(403).json({ error: "CORS policy: This origin is not allowed." });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 10000; 

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("✅ Allowed origins:", allowedOrigins);
});