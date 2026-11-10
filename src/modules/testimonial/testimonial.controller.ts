import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import {
  getPublicTestimonials,
  adminListTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialVisibility,
  reorderTestimonials,
} from './testimonial.service.js';
import type { CreateTestimonialInput, UpdateTestimonialInput } from './testimonial.validation.js';
import type { ReorderBody } from '@/utils/reorder.js';

export const getTestimonialsPublicHandler: RequestHandler = catchAsync(async (_req, res) => {
  const testimonials = await getPublicTestimonials();
  sendResponse(res, { message: 'Testimonials retrieved', data: testimonials });
});

export const getTestimonialsAdminHandler: RequestHandler = catchAsync(async (req, res) => {
  const { items, meta } = await adminListTestimonials(req);
  sendResponse(res, { message: 'Testimonials retrieved', data: items, meta: { ...meta } });
});

export const getTestimonialByIdHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const t = await getTestimonialById(id);
  sendResponse(res, { message: 'Testimonial retrieved', data: t });
});

export const createTestimonialHandler: RequestHandler = catchAsync(async (req, res) => {
  const t = await createTestimonial(req.body as CreateTestimonialInput);
  sendResponse(res, { statusCode: 201, message: 'Testimonial created', data: t });
});

export const updateTestimonialHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const t = await updateTestimonial(id, req.body as UpdateTestimonialInput);
  sendResponse(res, { message: 'Testimonial updated', data: t });
});

export const deleteTestimonialHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  await deleteTestimonial(id);
  sendResponse(res, { message: 'Testimonial deleted' });
});

export const toggleTestimonialVisibilityHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const t = await toggleTestimonialVisibility(id);
  sendResponse(res, { message: 'Visibility toggled', data: t });
});

export const reorderTestimonialsHandler: RequestHandler = catchAsync(async (req, res) => {
  await reorderTestimonials((req.body as ReorderBody).items);
  sendResponse(res, { message: 'Testimonials reordered' });
});
