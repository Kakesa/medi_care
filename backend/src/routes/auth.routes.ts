import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { buildLoginRateLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator.js';

const router = Router();
const limiter = buildLoginRateLimiter();

router.post('/login', limiter, validate(loginSchema), authController.login);
router.post('/forgot-password', limiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', limiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/register', limiter, validate(registerSchema), authController.register);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.post('/logout', authenticate, authController.logout);

export default router;
