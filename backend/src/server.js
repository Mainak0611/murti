// backend/src/server.js (CORS-ready for Vercel + Local)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import registerRoutes from "./routes.js";

dotenv.config();

const app = express();

// Read allowed origins from env (comma-separated). Useful for localhost, Vercel preview, production, etc.
const rawAllowed = process.env.ALLOWED_ORIGINS || "http://localhost:5173";
const allowedOrigins = rawAllowed.split(",").map(s => s.trim()).filter(Boolean);

// CORS options with dynamic origin check
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl or server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Not allowed
    return callback(new Error("CORS policy: This origin is not allowed."), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true, // allow cookies/Authorization header if used
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());

// Register modular routes
registerRoutes(app);

// Simple health / ready endpoint (useful for Render health check)
app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));

// Fallback root
app.get("/", (req, res) => res.send("Backend server is running."));

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("✅ Allowed origins:", allowedOrigins);
});
