import { Router } from 'express';
import AdminIncidentController from './AdminIncidentController.js';

export { default as incidentService } from './IncidentService.js';

export const adminRoutes = Router();
adminRoutes.get('/incidents', AdminIncidentController.index);
adminRoutes.get('/incidents/:id', AdminIncidentController.show);
adminRoutes.patch('/incidents/:id/resolve', AdminIncidentController.resolve);
adminRoutes.patch('/incidents/:id/reopen', AdminIncidentController.reopen);
adminRoutes.delete('/incidents/:id', AdminIncidentController.delete);
