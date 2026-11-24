import { timingSafeEqual } from 'node:crypto';

export function requireService(req, res, next) {
  const expected = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN || '');
  const provided = Buffer.from(req.get('x-service-token') || '');
  if (
    !expected.length ||
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return res.status(401).json({ error: 'Credencial interna inválida.' });
  }
  return next();
}
