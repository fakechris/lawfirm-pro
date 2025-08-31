import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log request
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  
  // Override end method to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): any {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};