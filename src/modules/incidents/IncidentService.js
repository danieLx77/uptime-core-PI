import prisma from './persistence.js';

class IncidentService {
  async handleStatus(monitorId, { success, errorLog }) {
    const openIncident = await prisma.incident.findFirst({
      where: { monitorId, status: 'OPEN' },
    });

    if (!success && !openIncident) {
      const incident = await prisma.incident.create({
        data: { monitorId, status: 'OPEN', errorLog },
      });
      console.log(`[ALERTA] Monitor ${monitorId} CAIU. Motivo: ${errorLog}`);
      return { stateChanged: true, incident };
    }

    if (success && openIncident) {
      const incident = await prisma.incident.update({
        where: { id: openIncident.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      console.log(`[RECUPERAÇÃO] Monitor ${monitorId} VOLTOU a ficar online.`);
      return { stateChanged: true, incident };
    }

    return { stateChanged: false, incident: openIncident };
  }
}

export default new IncidentService();
