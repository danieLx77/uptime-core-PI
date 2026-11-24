import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma, { consumePasswordResetDigest } from './persistence.js';
import mailer from './mail.js';

const recoveryMessage = 'Se o e-mail existir, um link de recuperação será enviado.';
const expiredMessage = 'Token expirado. Solicite uma nova recuperação.';

function digestToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class PasswordController {
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const token = crypto.randomBytes(20).toString('hex');

        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetDigest: digestToken(token),
            passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
          },
        });

        try {
          await mailer.sendMail({
            to: email,
            from: '"UptimeCore Suporte" <suporte@uptimecore.com>',
            subject: 'Recuperação de Senha',
            html: `<p>Você solicitou uma recuperação de senha.</p>
               <p>Utilize o token abaixo para redefinir sua senha:</p>
               <h3>${token}</h3>
               <p>Este token expira em 1 hora.</p>`,
          });
        } catch {
          console.error('Falha no envio do e-mail de recuperação de senha.');
        }
      }
      return res.status(200).json({ message: recoveryMessage });
    } catch {
      console.error('Falha ao solicitar recuperação de senha.');
      return res
        .status(500)
        .json({ error: 'Erro interno no servidor ao tentar recuperar a senha.' });
    }
  }

  async resetPassword(req, res) {
    try {
      const { email, token, newPassword } = req.body;

      if (!email || !token || !newPassword) {
        return res.status(400).json({ error: 'E-mail, token e nova senha são obrigatórios.' });
      }
      if (typeof token !== 'string') {
        return res.status(400).json({ error: 'Token inválido.' });
      }
      if (typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'Nova senha inválida.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      const digest = digestToken(token);

      if (digest !== user?.passwordResetDigest) {
        return res.status(400).json({ error: 'Token inválido.' });
      }
      if (!user.passwordResetExpires || user.passwordResetExpires <= new Date()) {
        return res.status(400).json({ error: expiredMessage });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const affected = await consumePasswordResetDigest(user.id, digest, passwordHash);
      if (affected === 0) {
        return res.status(400).json({ error: 'Token inválido.' });
      }

      return res.status(200).json({ message: 'Senha atualizada com sucesso.' });
    } catch {
      console.error('Falha ao redefinir a senha.');
      return res
        .status(500)
        .json({ error: 'Erro interno no servidor ao tentar redefinir a senha.' });
    }
  }
}

export default new PasswordController();
