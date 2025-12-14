// backend/src/routes.js

// Import all module route files
import paymentRoutes from "./modules/payments/paymentRoutes.js";
import userRoutes from "./modules/users/userRoutes.js";
import partyRoutes from "./modules/partyEnquiry/partyRoutes.js";
import itemRoutes from "./modules/itemMaster/itemMasterRoutes.js"; // <--- Import Item Routes
import orderRoutes from './modules/confirmedOrders/confirmedOrdersRoutes.js';

import { protect } from "./middleware/authMiddleware.js";

/**
 * Registers all module routes with the main Express application instance.
 * @param {object} app - The Express application instance.
 */
const registerRoutes = (app) => {
  // Payment routes already have protect middleware applied per-route in paymentRoutes.js
  app.use("/api/payments", paymentRoutes);

  // Keep user routes public for register/login/password-reset endpoints.
  app.use("/api/users", userRoutes);

  app.use("/api/party-enquiries", partyRoutes);

  // Register Item Master routes
  app.use("/api/items", itemRoutes); // <--- Register endpoint

  app.use('/api/orders', orderRoutes);
};

export default registerRoutes;