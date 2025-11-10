// backend/src/server.js (FINAL Modular Setup)

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import registerRoutes from "./routes.js"; 
// ^ Ensure this import is below dotenv.config() for safety,
// though in ESM it's often hoisted, loading it first is safer.

// 1. Load environment variables FIRST
dotenv.config(); 
const app = express();

// 2. CORS Middleware 
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

app.use(express.json());

// 3. Define Routes using the global route registration
registerRoutes(app); 

// 4. Fallback/Test Route
app.get('/', (req, res) => {
    res.send("Backend server is running.");
});

// 5. Start server (Uses the port defined by .env or 5001)
const PORT = process.env.PORT || 5001; 
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));