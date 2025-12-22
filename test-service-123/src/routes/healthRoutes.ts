import { Router } from 'express';
import { healthCheck, readinessCheck } from '../controllers/healthController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Health check endpoint for monitoring
router.get('/health', healthCheck);

// Readiness check endpoint for Kubernetes
router.get('/ready', asyncHandler(readinessCheck));

export default router;
