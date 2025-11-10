// backend/src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// --- FIX: Rely *only* on the environment variable ---
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    // Application will crash if the key is missing, preventing insecure operations
    throw new Error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
}
// ----------------------------------------------------

export const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check for token in the Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (split "Bearer [token]")
            token = req.headers.authorization.split(' ')[1];

            // Verify token using the secure JWT_SECRET
            const decoded = jwt.verify(token, JWT_SECRET);

            // Attach user ID (and any other payload info) to the request
            req.user = { id: decoded.id, email: decoded.email };

            next();
        } catch (error) {
            // This catches 'JsonWebTokenError: invalid signature' and other JWT errors
            console.error('Token validation failed:', error.message);
            res.status(401).json({ 
                message: 'Not authorized, token failed',
                details: error.name // e.g., JsonWebTokenError
            });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
});