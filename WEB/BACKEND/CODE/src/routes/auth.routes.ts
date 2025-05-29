import { Router } from 'express';
import container from '../di/inversify.config';
import { TYPES } from '../di/types';
import { AuthenticationController } from '../controllers/authentication.controller';

/**
 * Factory that returns a new auth router each time.
 * The resolvelafjklhfasdjkfhasdjklfhasdjkfhasdjkfd controller instance is proxied by the Inversify tracing
 * middleware, so every method call becomes a Jaeger span.
 */
export const authenticationRoutes = (): Router => {
  const router = Router();

  const authCtrl = container.get<AuthenticationController>(
    TYPES.AuthenticationController,
  );

  /* ───────── Authentication ───────── */
  router.post('/signup',  authCtrl.signUp.bind(authCtrl));
  router.post('/signin',  authCtrl.signIn.bind(authCtrl));

  /* ───────── Password‑reset flow ───────── */
  router.post(
    '/request-password-reset',
    authCtrl.requestPasswordReset.bind(authCtrl),
  );
  router.post('/set-password', authCtrl.setPassword.bind(authCtrl));

  return router;
};

/* default export to keep existing imports working */
export default authenticationRoutes;
