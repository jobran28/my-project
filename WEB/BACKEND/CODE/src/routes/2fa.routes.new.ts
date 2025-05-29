import { Router } from 'express';
import container from '../di/inversify.config';

import { TYPES } from '../di/types';
import { TwoFactorAuthController } from '../controllers/2fa';

/**
 * Factory that returns a fresh router every time it's imported.
 * All controller methods are `bind`‑ed so `this` works, and every call
 * is auto‑traced by the Inversify tracing middleware you added earlier.
 * 
 * Note: Authentication is now handled at the index level, so this router
 * contains both public and protected endpoints based on the route path.
 */
export const twoFactorAuthRoutes = (): Router => {
  const router = Router();

  /* Resolve singletons from the container (they'll be proxied for tracing) */
  const ctrl = container.get<TwoFactorAuthController>(TYPES.TwoFactorAuthController);

  /** @route POST /2fa/validate – Validate a supplied 2FA token (public) */
  router.post('/validate', ctrl.validateTwoFactorToken.bind(ctrl));

  /** @route GET /2fa/generate – Generate a new 2FA QR code (protected) */
  router.get('/generate', ctrl.generateTwoFactorAuth.bind(ctrl));

  /** @route POST /2fa/verify – Verify a 2FA token & enable 2FA (protected) */
  router.post('/verify', ctrl.verifyAndEnableTwoFactor.bind(ctrl));

  /** @route DELETE /2fa – Disable 2FA (protected) */
  router.delete('/', ctrl.disableTwoFactor.bind(ctrl));

  return router;
};

/* default export keeps existing import lines working */
export default twoFactorAuthRoutes;
