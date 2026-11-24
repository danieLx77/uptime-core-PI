import { deepEqual, equal, match } from 'node:assert/strict';
import { test } from 'node:test';
import { violationsIn } from './check.mjs';

const app = 'src/app.js';
const database = 'src/config/database.js';
const monitor = 'src/modules/monitoring/index.js';
const monitoringPersistence = 'src/modules/monitoring/persistence.js';
const incidents = 'src/modules/incidents/index.js';
const privateIncident = 'src/modules/incidents/IncidentService.js';
const files = new Set([app, database, monitor, monitoringPersistence, incidents, privateIncident]);

test('permite composição pública e acesso ao Prisma pela persistência', () => {
  deepEqual(violationsIn(app, "import './modules/monitoring/index.js'", files), []);
  deepEqual(violationsIn(monitoringPersistence, "import '../../config/database.js'", files), []);
  deepEqual(violationsIn(incidents, "export { default } from './IncidentService.js'", files), []);
});

test('rejeita acesso privado de outro contexto e da composição', () => {
  match(
    violationsIn(monitor, "import '../incidents/IncidentService.js'", files)[0],
    /apenas a composição/
  );
  match(
    violationsIn(app, "import './modules/incidents/IncidentService.js'", files)[0],
    /pontos públicos/
  );
});

test('impede as duas arestas que formariam um ciclo entre contextos', () => {
  equal(violationsIn(monitor, "import '../incidents/index.js'", files).length, 1);
  match(
    violationsIn(incidents, "export { scheduler } from '../monitoring/index.js'", files)[0],
    /apenas a composição/
  );
});

test('rejeita import direto do Prisma e dependência inversa da composição', () => {
  match(violationsIn(monitor, "import '../../config/database.js'", files)[0], /Prisma restrito/);
  match(violationsIn(monitor, "import '../../app.js'", files)[0], /não pode depender/);
});

test('rejeita destino não resolvido e permite pacotes com escopo', () => {
  match(violationsIn(monitor, "import './inexistente.js'", files)[0], /fora das fontes/);
  deepEqual(violationsIn(monitor, "import '@example/library'", files), []);
});

test('restringe dependências estáticas do Prisma à infraestrutura', () => {
  for (const specifier of ['@prisma/client', '@prisma/client/extension', '@prisma/adapter-pg']) {
    const source = `import '${specifier}'`;
    deepEqual(violationsIn(database, source, files), []);
    for (const file of [app, privateIncident, monitoringPersistence]) {
      match(violationsIn(file, source, files)[0], /pacotes Prisma restritos/);
    }
  }

  match(
    violationsIn(incidents, "export { PrismaClient } from '@prisma/client'", files)[0],
    /pacotes Prisma restritos/
  );
});

test('rejeita reexport de todos os símbolos e namespaces em pontos públicos', () => {
  for (const exportClause of ['*', '* as internals']) {
    const source = `export /* interface */ ${exportClause}
      from './IncidentService.js'`;
    match(violationsIn(incidents, source, files)[0], /devem nomear cada export/);
  }

  const explicitExport = "export { default as incidentService } from './IncidentService.js'";
  deepEqual(violationsIn(incidents, explicitExport, files), []);
});
