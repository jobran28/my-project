import { Router } from 'express';
import container from '../di/inversify.config';
import { TYPES } from '../di/types';

import { RepositoryController } from '../controllers/repository.controller';
import { UserController } from '../controllers/user.controller';
import { AdminMiddleware } from '../middlewares/admin.middleware';

/**
 * Factory that returns a fresh Admin router.
 * Controller instances are resolved through Inversify, so every method call
 * is automatically wrapped in a tracing span by your middleware.
 */
export const adminRoutes = (): Router => {
  const router = Router();

  /* Resolve singleton controllers (proxied for tracing) */
  const repoCtrl  = container.get<RepositoryController>(TYPES.RepositoryController);
  const userCtrl  = container.get<UserController>(TYPES.UserController);
  const admin     = container.get<AdminMiddleware>(TYPES.AdminMiddleware);

  /* Protect all admin routes with admin middleware only */
  router.use(admin.authorize.bind(admin));

  /* ───────── Repository management ───────── */
  router.get(
    '/repositories',
    repoCtrl.getAllRepositories.bind(repoCtrl),
  );

  router.delete(
    '/repositories/:id',
    repoCtrl.deleteRepository.bind(repoCtrl),
  );

  /* ───────── User management ───────── */
  router.get(
    '/users',
    userCtrl.getAllUsers.bind(userCtrl),
  );

  router.delete(
    '/users/:id',
    userCtrl.deleteUser.bind(userCtrl),
  );

  return router;
};

/* default export for backward‑compatible imports */
export default adminRoutes;
