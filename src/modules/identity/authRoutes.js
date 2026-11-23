import { Router } from 'express';
import PasswordController from './PasswordController.js';
import SessionController from './SessionController.js';
import UserController from './UserController.js';

const routes = new Router();

// Rotas Públicas
routes.post('/register', UserController.create);
routes.post('/login', SessionController.create);

// Rotas de recuperação
routes.post('/forgot-password', PasswordController.forgotPassword);
routes.post('/reset-password', PasswordController.resetPassword);

export default routes;
