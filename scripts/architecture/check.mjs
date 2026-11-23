import { readFile, readdir } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';

const contextPattern = /^src\/modules\/([^/]+)\//;
const database = 'src/config/database.js';
const compositionFiles = new Set([
  'src/app.js',
  'src/routes/adminRoutes.js',
  'src/monitoringWorkflow.js',
]);

export function violationsIn(file, source, knownFiles) {
  const module = new SourceTextModule(source, { identifier: file });
  const owner = file.match(contextPattern)?.[1];
  const violations = [];

  for (const { specifier } of module.moduleRequests) {
    const label = `${file} → ${specifier}`;
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      if (/^[#/.]/.test(specifier) || specifier.startsWith('file:')) {
        violations.push(`${label}: use caminho relativo para arquivos internos de src`);
      }
      continue;
    }

    const target = posix.normalize(posix.join(posix.dirname(file), specifier));
    if (!knownFiles.has(target)) {
      if (!target.startsWith('src/') || !target.endsWith('.json')) {
        violations.push(`${label}: destino fora das fontes verificadas`);
      }
      continue;
    }

    const targetOwner = target.match(contextPattern)?.[1];
    if (targetOwner && targetOwner !== owner) {
      if (
        owner ||
        !compositionFiles.has(file) ||
        target !== `src/modules/${targetOwner}/index.js`
      ) {
        violations.push(
          `${label}: apenas a composição pode integrar contextos pelos pontos públicos`
        );
      }
    } else if (owner && !targetOwner && target !== database) {
      violations.push(
        `${label}: contexto não pode depender da composição ou de outro código externo`
      );
    }

    if (target === database && file !== `src/modules/${owner}/persistence.js`) {
      violations.push(`${label}: cliente Prisma restrito à persistência do contexto`);
    }
  }

  return violations;
}

async function checkSources() {
  const root = new URL('../../', import.meta.url);
  const files = (await readdir(new URL('src/', root), { recursive: true }))
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => `src/${file}`);
  const knownFiles = new Set(files);
  const results = await Promise.all(
    files.map(async (file) =>
      violationsIn(file, await readFile(new URL(file, root), 'utf8'), knownFiles)
    )
  );

  const violations = results.flat();
  if (violations.length > 0) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log(`Fronteiras verificadas em ${files.length} arquivos JavaScript.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await checkSources();
}
