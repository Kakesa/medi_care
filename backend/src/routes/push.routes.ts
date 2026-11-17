import { Router } from 'express';
import * as push from '../controllers/push.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '../validators/push.validator.js';

const router = Router();

router.use(authenticate);
router.get('/key', push.key);
router.post('/subscribe', validate(pushSubscribeSchema), push.subscribe);
router.post('/unsubscribe', validate(pushUnsubscribeSchema), push.unsubscribe);

export default router;
