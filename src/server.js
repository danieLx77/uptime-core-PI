import app from './app.js';
import { startMonitoring } from './monitoringWorkflow.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 UptimeCore API rodando em http://localhost:${PORT}`);

  // Dá inicio ao motor de monitoramento!
  startMonitoring();
});
