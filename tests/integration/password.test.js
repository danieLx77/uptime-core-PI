import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../support/gateway.js';
import prisma, { core } from '../support/database.js';
import { runOverlappingWrites } from '../support/concurrency.js';
import mailer from '../../services/core/src/modules/identity/mail.js';

describe('Integração: Recuperação de Senha', () => {
  let testUser;

  function emailedToken() {
    const message = mailer.sendMail.mock.calls.at(-1)[0];
    return /<h3>([a-f0-9]{40})<\/h3>/.exec(message.html)[1];
  }

  async function issue() {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email })
      .expect(200);
    return emailedToken();
  }

  function reset(token, newPassword = 'nova_senha_segura') {
    return request(app)
      .post('/api/auth/reset-password')
      .send({ email: testUser.email, token, newPassword });
  }

  beforeAll(async () => {
    // 2. O espião agora vive dentro do ciclo de vida do Jest
    jest.spyOn(mailer, 'sendMail').mockResolvedValue(true);

    await prisma.user.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash('senha_antiga', salt);

    testUser = await prisma.user.create({
      data: {
        name: 'Usuário Esquecido',
        email: 'esquecido@exemplo.com',
        password_hash,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    jest.restoreAllMocks();
  });

  // --- BLOCO 1: ESQUECI A SENHA ---

  it('deve gerar um token e simular o envio de e-mail (200 OK)', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'esquecido@exemplo.com' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Se o e-mail existir, um link de recuperação será enviado.');

    // Validação Estratégica: O mock do e-mail foi acionado?
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);

    // Validação de Banco: O token foi salvo no usuário?
    const updatedUser = await prisma.user.findUnique({ where: { email: 'esquecido@exemplo.com' } });
    const token = emailedToken();
    expect(updatedUser.passwordResetDigest).toBe(createHash('sha256').update(token).digest('hex'));
    expect(updatedUser.passwordResetDigest).not.toBe(token);
    expect(JSON.stringify(response.body)).not.toContain(token);
    expect(updatedUser.passwordResetExpires).not.toBeNull();
  });

  it('deve retornar 200 OK para e-mail inexistente, mas NÃO deve enviar e-mail', async () => {
    // Limpa a contagem do mock para este teste
    jest.clearAllMocks();

    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'fantasma@exemplo.com' });

    // A resposta deve ser idêntica ao caminho feliz (Prevenção de Email Enumeration)
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Se o e-mail existir, um link de recuperação será enviado.');

    // A prova de segurança: O e-mail NUNCA deve ser disparado
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  // --- BLOCO 2: REDEFINIÇÃO DE SENHA ---

  it('não deve redefinir com token inválido (400 Bad Request)', async () => {
    const response = await request(app).post('/api/auth/reset-password').send({
      email: 'esquecido@exemplo.com',
      token: 'token_falso_123',
      newPassword: 'nova_senha_segura',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Token inválido.');
  });

  it('deve redefinir a senha com sucesso e limpar os tokens no banco', async () => {
    const token = await issue();
    const response = await reset(token);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Senha atualizada com sucesso.');

    // Prova de limpeza: O banco não deve mais conter o token de uso único
    const finalUser = await prisma.user.findUnique({ where: { email: 'esquecido@exemplo.com' } });
    expect(finalUser.passwordResetDigest).toBeNull();
    expect(finalUser.passwordResetExpires).toBeNull();

    // Prova de criptografia: Validamos se a nova senha realmente funciona
    const passwordMatch = await bcrypt.compare('nova_senha_segura', finalUser.password_hash);
    expect(passwordMatch).toBe(true);
    await reset(token).expect(400);
  });

  it('rejeita um token expirado', async () => {
    const token = await issue();
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordResetExpires: new Date(Date.now() - 1000) },
    });
    const response = await reset(token).expect(400);
    expect(response.body.error).toBe('Token expirado. Solicite uma nova recuperação.');
  });

  it('invalida o token substituído por uma nova solicitação', async () => {
    const first = await issue();
    const second = await issue();
    expect(second).not.toBe(first);
    await reset(first).expect(400);
    await reset(second).expect(200);
  });

  it('consome o mesmo token uma única vez sob concorrência real', async () => {
    const token = await issue();
    const passwords = ['senha-concorrente-1', 'senha-concorrente-2'];
    const responses = await runOverlappingWrites(
      core,
      'users',
      passwords.map((password) => () => reset(token, password).then((response) => response))
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const winner = responses.findIndex((response) => response.status === 200);
    const user = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(user.passwordResetDigest).toBeNull();
    expect(await bcrypt.compare(passwords[winner], user.password_hash)).toBe(true);
    expect(await bcrypt.compare(passwords[1 - winner], user.password_hash)).toBe(false);
    await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: passwords[winner] })
      .expect(200);
  }, 20000);
});
