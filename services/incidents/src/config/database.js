import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.INCIDENTS_DATABASE_URL) throw new Error('INCIDENTS_DATABASE_URL é obrigatória.');

// 1. Cria o pool de conexões com o banco via driver nativo
const pool = new Pool({
  connectionString: process.env.INCIDENTS_DATABASE_URL,
});

// 2. Instancia o adaptador do Prisma para o Postgres
const adapter = new PrismaPg(pool);

// 3. Inicializa o cliente com o adaptador
const prisma = new PrismaClient({ adapter });

export default prisma;
