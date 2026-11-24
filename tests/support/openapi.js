import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const validators = new WeakMap();

export function assertJsonResponse(spec, path, method, { status, body, headers }) {
  const schema =
    spec.paths[path]?.[method]?.responses[status]?.content?.['application/json']?.schema;
  assert.ok(schema, `Resposta JSON não documentada para ${method} ${path}: ${status}`);
  assert.match(headers['content-type'], /^application\/json\b/);

  let ajv = validators.get(spec);
  if (!ajv) {
    // Os schemas atuais usam o subconjunto OpenAPI 3.0 suportado pelo Ajv,
    // incluindo nullable explícito, oneOf e referências a components/schemas.
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(spec, 'contract');
    validators.set(spec, ajv);
  }
  const encodedPath = path.replaceAll('~', '~0').replaceAll('/', '~1');
  const ref = `contract#/paths/${encodedPath}/${method}/responses/${status}/content/application~1json/schema`;
  const validate = ajv.getSchema(ref);
  assert.ok(validate(body), ajv.errorsText(validate.errors));
}
