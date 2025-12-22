import { Router } from 'express';
import { getApiVersion } from '../controllers/apiController';
import userRoutes from '../api/v1/users/user.routes';
import taskRoutes from '../api/v1/tasks/task.routes';

const router = Router();

// API v1 root endpoint
router.get('/', getApiVersion);

// API v1 resource routes
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);

// Future routes will be added here in subsequent phases
// router.use('/auth', authRoutes);

export default router;
