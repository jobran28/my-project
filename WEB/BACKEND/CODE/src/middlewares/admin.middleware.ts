import { Request, Response, NextFunction } from 'express';
import { injectable } from 'inversify';
import { AuthenticatedUser } from '../types/auth.types';

@injectable()
export class AdminMiddleware {
    /**
     * Middleware to authorize admin-only requests
     * Checks if the authenticated user has admin privileges
     * Should be used after authentication middleware
     */
    public authorize = (req: Request, res: Response, next: NextFunction): void => {
        // Check if user is authenticated (should be set by auth middleware)
        if (!req.user) {
            res.status(401).json({
                status: 'error',
                message: 'Authentication required. Please authenticate first.'
            });
            return;
        }

        // Check if user has admin privileges
        if (!req.user.is_admin) {
            res.status(403).json({
                status: 'error',
                message: 'Access denied. Admin privileges required.'
            });
            return;
        }

        // User is authenticated and has admin privileges, continue to the route
        next();
    };
}
