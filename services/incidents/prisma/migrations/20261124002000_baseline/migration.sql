CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "incidentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'EMAIL',
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "errorLog" TEXT;
