import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  // Database errors
  if (error.message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists'
    } as ApiError);
  }

  if (error.message.includes('FOREIGN KEY constraint failed')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid reference to related resource'
    } as ApiError);
  }

  // Authentication errors
  if (error.message.includes('Invalid email or password')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid email or password'
    } as ApiError);
  }

  if (error.message.includes('User with this email already exists')) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'User with this email already exists'
    } as ApiError);
  }

  if (error.message.includes('Invalid or expired pairing code')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid or expired pairing code'
    } as ApiError);
  }

  // Encryption errors
  if (error.message.includes('Failed to encrypt') || error.message.includes('Failed to decrypt')) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Data processing error'
    } as ApiError);
  }

  // Validation errors
  if (error.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      // @ts-ignore
      details: error.errors
    } as ApiError);
  }

  // Default error
  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : error.message
  } as ApiError);
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  } as ApiError);
};