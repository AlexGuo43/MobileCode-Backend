import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      return next(error);
    }
  };
};

// Validation schemas
export const schemas = {
  createUser: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required').max(100, 'Name too long')
  }),

  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
    device_name: z.string().min(1, 'Device name is required').max(50, 'Device name too long'),
    device_type: z.enum(['mobile', 'desktop'], {
      errorMap: () => ({ message: 'Device type must be mobile or desktop' })
    }),
    platform: z.string().min(1, 'Platform is required').max(20, 'Platform name too long')
  }),

  pairDevice: z.object({
    code: z.string().length(6, 'Pairing code must be 6 digits').regex(/^\d{6}$/, 'Pairing code must be numeric'),
    device_name: z.string().min(1, 'Device name is required').max(50, 'Device name too long'),
    device_type: z.enum(['mobile', 'desktop'], {
      errorMap: () => ({ message: 'Device type must be mobile or desktop' })
    }),
    platform: z.string().min(1, 'Platform is required').max(20, 'Platform name too long')
  }),

  syncFile: z.object({
    filename: z.string().min(1, 'Filename is required').max(255, 'Filename too long'),
    content: z.string(),
    file_type: z.string().min(1, 'File type is required').max(20, 'File type too long'),
    last_modified: z.string().datetime('Invalid date format')
  }),

  syncFiles: z.object({
    files: z.array(z.object({
      filename: z.string().min(1, 'Filename is required').max(255, 'Filename too long'),
      content: z.string(),
      file_type: z.string().min(1, 'File type is required').max(20, 'File type too long'),
      last_modified: z.string().datetime('Invalid date format')
    })).max(100, 'Too many files in single sync request')
  })
};