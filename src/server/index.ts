import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { generateDoctorReport } from './doctor.js';
import { loadServerConfig } from './config.js';
import type { HealthStatus } from '../shared/contracts.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const startTime = Date.now();
  const storageDir = path.join(process.cwd(), 'storage');

  // Servir arquivos estáticos de mídia da pasta storage
  app.use('/media', express.static(storageDir));

  app.get('/api/health', (_req, res) => {
    const health: HealthStatus = {
      status: 'ok',
      service: 'fabrica-de-bermudas-2',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - startTime) / 1000,
    };
    res.json(health);
  });

  app.get('/api/doctor', (_req, res) => {
    const report = generateDoctorReport();
    res.json(report);
  });

  return app;
}

export function startServer() {
  const config = loadServerConfig();
  const app = createApp();

  const server = app.listen(config.port, config.host, () => {
    console.log(`[Fábrica de Bermudas 2.0] Servidor rodando em http://${config.host}:${config.port}`);
    console.log(`- Health: http://${config.host}:${config.port}/api/health`);
    console.log(`- Doctor: http://${config.host}:${config.port}/api/doctor`);
  });

  return server;
}

// Se for executado diretamente via CLI/tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
