import { Router } from 'express';
import AdminAlertController from './AdminAlertController.js';

export { default as alertService } from './AlertService.js';

export const adminRoutes = Router();
adminRoutes.get('/alerts', AdminAlertController.index);
adminRoutes.get('/alerts/:id', AdminAlertController.show);
adminRoutes.delete('/alerts/:id', AdminAlertController.delete);
