import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { generateDoctorReport } from './doctor.js';
import { loadServerConfig } from './config.js';
import {
  createProject,
  getProject,
  listProjects,
  updateProjectPlan,
  approveProjectRevision,
  executeProjectJob,
  renderProjectVideo,
} from './jobs.js';
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

  // ==========================================
  // ROTAS DE PROJETOS E ESTÚDIO (Sprint 5)
  // ==========================================

  // Listar todos os projetos
  app.get('/api/projects', (_req, res) => {
    try {
      const projects = listProjects();
      res.json(projects);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Criar novo projeto
  app.post('/api/projects', (req, res) => {
    try {
      const { title, scriptText, characterId } = req.body;
      if (!title || !scriptText) {
        return res.status(400).json({ error: 'Título e texto do roteiro são obrigatórios.' });
      }
      const meta = createProject({ title, scriptText, characterId });
      res.status(201).json(meta);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Obter detalhes de um projeto
  app.get('/api/projects/:id', (req, res) => {
    try {
      const project = getProject(req.params.id);
      res.json(project);
    } catch (err) {
      res.status(404).json({ error: String(err) });
    }
  });

  // Disparar geração (planejamento + voz + timeline)
  app.post('/api/projects/:id/generate', async (req, res) => {
    try {
      const result = await executeProjectJob(req.params.id, req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Atualizar plano de direção de cena (revisão visual)
  app.put('/api/projects/:id/plan', (req, res) => {
    try {
      updateProjectPlan(req.params.id, req.body);
      res.json({ status: 'ok', message: 'Plano de cena atualizado com sucesso.' });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // Aprovar revisão do projeto
  app.post('/api/projects/:id/approve', (req, res) => {
    try {
      const meta = approveProjectRevision(req.params.id);
      res.json(meta);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // Renderizar vídeo final do projeto
  app.post('/api/projects/:id/render', async (req, res) => {
    try {
      const renderResult = await renderProjectVideo(req.params.id);
      res.json(renderResult);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
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
