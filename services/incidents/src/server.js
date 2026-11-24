import app from './app.js';

const port = process.env.PORT || 3002;
app.listen(port, () => console.log(`Serviço Incidentes ouvindo na porta ${port}.`));
