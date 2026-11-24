import { afterAll, beforeAll } from '@jest/globals';
import core from '../../services/core/src/app.js';
import incidents from '../../services/incidents/src/app.js';
import { createGateway } from '../../gateway/src/app.js';
import { closeServer, listen } from './servers.js';

let gateway;
let coreServer;
let incidentsServer;

beforeAll(async () => {
  coreServer = await listen(core);
  incidentsServer = await listen(incidents);
  process.env.CORE_URL = coreServer.url;
  process.env.INCIDENTS_URL = incidentsServer.url;
  gateway = createGateway({ coreUrl: coreServer.url, incidentsUrl: incidentsServer.url });
});

afterAll(async () => {
  await Promise.all([closeServer(coreServer?.server), closeServer(incidentsServer?.server)]);
});

export { gateway as default };
