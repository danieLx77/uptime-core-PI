import prisma from '../../config/database.js';

export function consumePasswordResetDigest(id, digest, passwordHash) {
  return prisma.$executeRaw`
    UPDATE "users"
    SET "password_hash" = ${passwordHash},
        "passwordResetDigest" = NULL,
        "passwordResetExpires" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
    WHERE "id" = ${id}
      AND "passwordResetDigest" = ${digest}
      AND "passwordResetExpires" > (clock_timestamp() AT TIME ZONE 'UTC')
  `;
}

export default Object.freeze({
  user: prisma.user,
});
