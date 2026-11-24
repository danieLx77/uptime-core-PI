import { createGateway } from './app.js';

const port = process.env.PORT || 3000;
createGateway({
  coreUrl: process.env.CORE_URL,
  incidentsUrl: process.env.INCIDENTS_URL,
}).listen(port, () => console.log(`Gateway ouvindo na porta ${port}.`));
