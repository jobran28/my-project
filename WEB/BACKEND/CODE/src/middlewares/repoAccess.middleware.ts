import { Request, Response, NextFunction } from 'express';
import { injectable } from 'inversify';

@injectable()
export class RepoAccessMiddleware {
  /**
   * Middleware factory for repository access control.
   * Usage: repoAccess.checkAccess('edit').bind(repoAccess)
   */
  public checkAccess(requiredLevel: 'view' | 'edit') {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.userId;
      const repoName = req.params.repoName || req.body.repoName || req.query.repoName;

      // TODO: Implement your database logic here to check if userId has requiredLevel access to repoName
      // Example placeholder logic (replace with real check)
      const hasAccess = true; // Set to false to simulate forbidden

      if (!userId || !repoName) {
        return res.status(400).json({ status: 'error', message: 'User or repository not specified.' });
      }

      if (!hasAccess) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient repository access.' });
      }

      next();
    };
  }
}
