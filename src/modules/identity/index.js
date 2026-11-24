import prisma from './persistence.js';

export { default as authRoutes } from './authRoutes.js';
export { default as userRoutes } from './userRoutes.js';
export { default as authenticate } from './auth.js';
export { default as requireAdmin } from './isAdmin.js';

export function countUsers() {
  return prisma.user.count();
}
