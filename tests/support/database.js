import core from '../../services/core/src/config/database.js';
import operational from '../../services/incidents/src/config/database.js';

// Facade exclusiva de fixtures para preservar as suites HTTP do monólito.
export { core, operational };
export default {
  user: core.user,
  monitor: core.monitor,
  checkExecution: core.checkExecution,
  incident: operational.incident,
  alert: operational.alert,
  $disconnect: () => Promise.all([core.$disconnect(), operational.$disconnect()]),
};
