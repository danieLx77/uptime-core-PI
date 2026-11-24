import prisma from '../../config/database.js';

export default Object.freeze({
  monitor: prisma.monitor,
  checkExecution: prisma.checkExecution,
});
