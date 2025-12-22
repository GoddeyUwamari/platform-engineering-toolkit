import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, ValidationError } from 'express-validator';

/**
 * Validation Middleware
 *
 * Processes express-validator validation chains
 * Returns formatted error responses
 */

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Execute all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    // Format validation errors with proper typing
    const formattedErrors = errors.array().map((error: ValidationError) => {
      if (error.type === 'field') {
        return {
          field: error.path,
          message: String(error.msg),
        };
      }
      return {
        field: 'unknown',
        message: String(error.msg),
      };
    });

    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: formattedErrors,
      },
      timestamp: new Date().toISOString(),
    });
  };
};
