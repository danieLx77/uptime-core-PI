import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);

async function sourceFiles(path) {
  const files = (await readdir(path, { recursive: true })).filter(
    (name) => name.endsWith('.js') && !name.startsWith('generated/')
  );
  return Promise.all(files.map((name) => readFile(new URL(name, path), 'utf8')));
}

function collectRoutes(sources, service) {
  const routes = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(
      /\b(app|routes|adminRoutes)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g
    )) {
      const [, router, method, path] = match;
      let prefix = '';
      if (router === 'adminRoutes' || path.startsWith('/check-executions') || path === '/status') {
        prefix = '/api/admin';
      } else if (router === 'routes' && source.includes('PasswordController')) {
        prefix = '/api/auth';
      } else if (router === 'routes' && source.includes('UserController')) {
        prefix = '/api/users';
      } else if (router === 'routes' && source.includes('MonitorController')) {
        prefix = '/api/monitors';
      }
      const publicPath = (prefix + (prefix && path === '/' ? '' : path)).replace(
        /:([\w]+)/g,
        '{$1}'
      );
      if (publicPath !== '/api/openapi.json') routes.add(`${method} ${publicPath}`);
    }
  }
  if (service === 'core') {
    const app = sources.find((source) => source.includes('const apiPresentation'));
    assert.match(app, /app\.get\(\['\/', '\/api'\]/);
    routes.add('get /');
    routes.add('get /api');
  }
  return routes;
}

for (const service of ['core', 'incidents']) {
  const dir = new URL(`../services/${service}/`, import.meta.url);
  const spec = JSON.parse(await readFile(new URL('openapi/openapi.json', dir), 'utf8'));
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.info.title && spec.info.version);
  const routes = collectRoutes(await sourceFiles(new URL('src/', dir)), service);
  const declared = new Set();

  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      assert.ok(methods.has(method), `${service}: método inválido: ${method}`);
      declared.add(`${method} ${path}`);
      assert.ok(
        operation.summary && Object.keys(operation.responses).some((code) => /^2\d\d$/.test(code))
      );
      for (const parameter of path.matchAll(/\{(\w+)\}/g)) {
        assert.ok(
          operation.parameters.some(
            ({ name, in: location, required }) =>
              name === parameter[1] && location === 'path' && required === true
          )
        );
      }
      if (path.startsWith('/internal/')) {
        assert.equal(operation['x-internal'], true);
        assert.deepEqual(operation.security, [{ serviceToken: [] }]);
      } else if (path.startsWith('/api/admin/')) {
        assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
      }
    }
  }

  assert.deepEqual([...declared].sort(), [...routes].sort(), `${service}: rotas divergentes`);
  for (const [, schema] of JSON.stringify(spec).matchAll(
    /"\$ref":"#\/components\/schemas\/(\w+)"/g
  )) {
    assert.ok(spec.components.schemas[schema], `${service}: referência ausente: ${schema}`);
  }
  console.log(`Contrato de ${service}: ${declared.size} operações conferidas.`);
}
