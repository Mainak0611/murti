import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import dotenv from 'dotenv';
import pool from '../config/db.js'; 

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
}

// --- 1. Protect Middleware (Authentication) ---
export const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // 1. Verify Token
            const decoded = jwt.verify(token, JWT_SECRET);

            // 2. Fetch User + Role + Active Permissions + Branch ID from DB
            const sql = `
                SELECT 
                    u.id, 
                    u.email, 
                    u.role,
                    u.branch_id, -- <--- FETCH BRANCH ID
                    COALESCE(
                        json_agg(up.module_key) FILTER (WHERE up.module_key IS NOT NULL), 
                        '[]'
                    ) as permissions
                FROM public.users u
                LEFT JOIN public.user_permissions up ON u.id = up.user_id
                WHERE u.id = $1
                GROUP BY u.id
            `;
            
            const { rows } = await pool.query(sql, [decoded.id]);

            if (rows.length === 0) {
                res.status(401);
                throw new Error('User not found');
            }

            // 3. Attach full user profile to request
            req.user = rows[0]; 
            // req.user now looks like: { id: 1, role: 'super_admin', branch_id: 1, permissions: [...] }

            next();
        } catch (error) {
            console.error('Token validation failed:', error.message);
            res.status(401).json({ 
                message: 'Not authorized, token failed',
                details: error.name 
            });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
});

export const restrictTo = (requiredRoleOrModule) => {
    return (req, res, next) => {
        // Safety check
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // 1. Super Admin bypasses ALL checks
        if (req.user.role === 'super_admin') {
            return next();
        }

        // 2. If the route specifically demands 'super_admin' access
        if (requiredRoleOrModule === 'super_admin') {
            return res.status(403).json({ error: 'Access denied: Super Admin privilege required' });
        }

        const userPerms = req.user.permissions || [];

        // 3. HANDLING ARRAYS (The Fix): Check if user has ANY of the required permissions
        if (Array.isArray(requiredRoleOrModule)) {
            // "some" returns true if at least one permission matches
            const hasAccess = requiredRoleOrModule.some(moduleKey => userPerms.includes(moduleKey));
            
            if (hasAccess) {
                return next();
            }
        } 
        // 4. HANDLING STRINGS (Old behavior): Check specific module
        else if (userPerms.includes(requiredRoleOrModule)) {
            return next();
        }

        // 5. Access Denied
        res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    };
};