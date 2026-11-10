import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { getPublicProfile } from '@/modules/profile/profile.service.js';
import { getPublicSkills } from '@/modules/skill/skill.service.js';
import { getPublicProjects } from '@/modules/project/project.service.js';
import { getPublicExperiences } from '@/modules/experience/experience.service.js';
import { getPublicEducation } from '@/modules/education/education.service.js';
import { getPublicTestimonials } from '@/modules/testimonial/testimonial.service.js';
import { getPublicSiteSettings } from '@/modules/siteSettings/siteSettings.service.js';

export const getHomeHandler: RequestHandler = catchAsync(async (req, res) => {
  const [profile, skills, projects, experiences, education, testimonials, siteSettings] =
    await Promise.all([
      getPublicProfile(),
      getPublicSkills(),
      getPublicProjects(req),
      getPublicExperiences(),
      getPublicEducation(),
      getPublicTestimonials(),
      getPublicSiteSettings(),
    ]);

  sendResponse(res, {
    message: 'Home data retrieved',
    data: { profile, skills, projects, experiences, education, testimonials, siteSettings },
  });
});
