import prisma, { openIfAbsent } from './persistence.js';

class IncidentService {
  async handleStatus(monitorId, { success, errorLog }) {
    if (!success) {
      const incident = await openIfAbsent(monitorId, errorLog);
      if (incident) {
        console.log(`[ALERTA] Monitor ${monitorId} CAIU. Motivo: ${errorLog}`);
        return { stateChanged: true, incident };
      }

      const openIncident = await prisma.incident.findFirst({
        where: { monitorId, status: 'OPEN' },
      });
      return { stateChanged: false, incident: openIncident };
    }

    const [incident] = await prisma.incident.updateManyAndReturn({
      where: { monitorId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    if (!incident) return { stateChanged: false, incident: null };

    console.log(`[RECUPERAÇÃO] Monitor ${monitorId} VOLTOU a ficar online.`);
    return { stateChanged: true, incident };
  }
}

export default new IncidentService();
