import { randomUUID } from 'node:crypto';
import prisma from '../../config/database.js';

export async function openIfAbsent(monitorId, errorLog) {
  const [incident] = await prisma.$queryRaw`
    INSERT INTO "incidents" ("id", "monitorId", "errorLog")
    VALUES (${randomUUID()}, ${monitorId}, ${errorLog ?? null})
    ON CONFLICT ("monitorId") WHERE "status" = 'OPEN' DO NOTHING
    RETURNING "id", "monitorId", "status"::text AS "status", "errorLog", "startedAt", "resolvedAt"
  `;
  return incident;
}

export default Object.freeze({
  incident: prisma.incident,
});
