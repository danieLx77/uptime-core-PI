import { readFile, readdir } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const sourceRoots = ['services/core/src', 'services/incidents/src', 'gateway/src'];
const prismaPackage = /^@prisma\/(?:client|adapter-pg)(?:\/|$)/;
const compositionFiles = new Set([
  'services/core/src/app.js',
  'services/core/src/routes/adminRoutes.js',
  'services/core/src/monitoringWorkflow.js',
  'services/incidents/src/app.js',
]);

function sourceRoot(path) {
  return sourceRoots.find((root) => path.startsWith(`${root}/`));
}

function context(path) {
  return /\/src\/modules\/([^/]+)\//.exec(path)?.[1];
}

export function violationsIn(file, source, knownFiles) {
  const { body } = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const root = sourceRoot(file);
  const owner = context(file);
  const database = `${root}/config/database.js`;
  const violations = [];

  for (const statement of body) {
    if (!statement.source) continue;

    const specifier = statement.source.value;
    const label = `${file} → ${specifier}`;
    if (
      owner &&
      file === `${root}/modules/${owner}/index.js` &&
      statement.type === 'ExportAllDeclaration'
    ) {
      violations.push(`${label}: pontos públicos devem nomear cada export`);
    }
    if (prismaPackage.test(specifier) && (file !== database || root === 'gateway/src')) {
      violations.push(`${label}: pacotes Prisma restritos à configuração do banco`);
    }
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      if (/^[#/.]/.test(specifier) || specifier.startsWith('file:')) {
        violations.push(`${label}: use caminho relativo para arquivos internos`);
      }
      continue;
    }

    const target = posix.normalize(posix.join(posix.dirname(file), specifier));
    const generated = `${root}/generated/prisma/`;
    if (file === database && target === `${generated}index.js` && root !== 'gateway/src') continue;
    if (target === `${posix.dirname(root)}/openapi/openapi.json` && !owner) continue;

    if (sourceRoot(target) !== root) {
      violations.push(`${label}: imports entre unidades de implantação são proibidos`);
      continue;
    }
    if (!knownFiles.has(target)) {
      violations.push(`${label}: destino fora das fontes verificadas`);
      continue;
    }

    const targetOwner = context(target);
    if (targetOwner && targetOwner !== owner) {
      if (
        owner ||
        !compositionFiles.has(file) ||
        target !== `${root}/modules/${targetOwner}/index.js`
      ) {
        violations.push(
          `${label}: apenas a composição pode integrar contextos pelos pontos públicos`
        );
      }
    } else if (
      owner &&
      !targetOwner &&
      target !== database &&
      target !== 'services/incidents/src/coreClient.js'
    ) {
      violations.push(
        `${label}: contexto não pode depender da composição ou de outro código externo`
      );
    }

    if (target === database && file !== `${root}/modules/${owner}/persistence.js`) {
      violations.push(`${label}: cliente Prisma restrito à persistência do contexto`);
    }
  }

  return violations;
}

async function checkSources() {
  const repo = new URL('../../', import.meta.url);
  const files = (
    await Promise.all(
      sourceRoots.map(async (root) =>
        (await readdir(new URL(`${root}/`, repo), { recursive: true }))
          .filter((file) => /\.(?:js|mjs)$/.test(file) && !file.startsWith('generated/'))
          .map((file) => `${root}/${file}`)
      )
    )
  )
    .flat()
    .sort();
  const knownFiles = new Set(files);
  const results = await Promise.all(
    files.map(async (file) =>
      violationsIn(file, await readFile(new URL(file, repo), 'utf8'), knownFiles)
    )
  );

  const violations = results.flat();
  if (violations.length > 0) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Fronteiras verificadas em ${files.length} arquivos JavaScript.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await checkSources();
}
