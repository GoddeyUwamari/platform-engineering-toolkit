import { Router } from 'express';
import healthRoutes from './healthRoutes';
import apiRoutes from './apiRoutes';
import { config } from '../config/environment';
import { getApiInfo } from '../controllers/apiController';

const router = Router();

// Root endpoint - API information
router.get('/', getApiInfo);

// Health and readiness checks (not versioned)
router.use('/', healthRoutes);

// Versioned API routes
router.use(`/api/${config.api_version}`, apiRoutes);

export default router;
