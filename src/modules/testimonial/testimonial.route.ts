import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { createTestimonialSchema, updateTestimonialSchema } from './testimonial.validation.js';
import { reorderBodySchema } from '@/utils/reorder.js';
import {
  getTestimonialsPublicHandler,
  getTestimonialsAdminHandler,
  getTestimonialByIdHandler,
  createTestimonialHandler,
  updateTestimonialHandler,
  deleteTestimonialHandler,
  toggleTestimonialVisibilityHandler,
  reorderTestimonialsHandler,
} from './testimonial.controller.js';

const router: IRouter = Router();

router.get('/', getTestimonialsPublicHandler);

router.get('/admin', authenticate, authorize('admin'), getTestimonialsAdminHandler);
router.post('/admin', authenticate, authorize('admin'), validateRequest(createTestimonialSchema), createTestimonialHandler);
router.put('/admin/reorder', authenticate, authorize('admin'), validateRequest(reorderBodySchema), reorderTestimonialsHandler);
router.get('/admin/:id', authenticate, authorize('admin'), getTestimonialByIdHandler);
router.patch('/admin/:id', authenticate, authorize('admin'), validateRequest(updateTestimonialSchema), updateTestimonialHandler);
router.patch('/admin/:id/visibility', authenticate, authorize('admin'), toggleTestimonialVisibilityHandler);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteTestimonialHandler);

export default router;
