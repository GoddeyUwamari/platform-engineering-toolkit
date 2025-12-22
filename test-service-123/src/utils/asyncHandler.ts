import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Async Handler Utility
 *
 * Wraps async route handlers to properly catch and forward errors to Express error middleware
 * Eliminates the need for try-catch blocks in every async route handler
 *
 * @example
 * ```typescript
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.findAll();
 *   res.json(users);
 * }));
 * ```
 */

/**
 * Wraps an async function to catch any errors and pass them to the next middleware
 *
 * @param fn - Async function that handles the request
 * @returns Express RequestHandler that properly handles promise rejections
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
