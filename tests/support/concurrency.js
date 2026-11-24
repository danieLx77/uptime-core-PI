import { setTimeout as delay } from 'node:timers/promises';

const locks = {
  incidents: (tx) => tx.$executeRaw`LOCK TABLE "incidents" IN SHARE MODE`,
  users: (tx) => tx.$executeRaw`LOCK TABLE "users" IN SHARE MODE`,
};

export async function runOverlappingWrites(db, table, operations) {
  let results;
  await db.$transaction(
    async (tx) => {
      await locks[table](tx);
      results = Promise.allSettled(operations.map((operation) => operation()));
      const deadline = Date.now() + 6000;
      do {
        const [waiting] = await tx.$queryRaw`
        SELECT count(*)::int AS count FROM pg_locks
        WHERE relation = CAST(${table} AS regclass)
          AND mode = 'RowExclusiveLock' AND NOT granted
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `;
        if (waiting.count >= operations.length) return;
        await delay(20);
      } while (Date.now() < deadline);
      throw new Error(`Escritas concorrentes não aguardaram o lock de ${table}.`);
    },
    { timeout: 9000 }
  );
  return (await results).map((result) => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
}
