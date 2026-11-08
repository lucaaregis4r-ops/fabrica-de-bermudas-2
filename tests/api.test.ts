import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/server/index.js';
import { getProjectDir } from '../src/server/jobs.js';
import type { Server } from 'node:http';

describe('API REST do Estúdio Fábrica de Bermudas (Sprint 5)', () => {
  const app = createApp();
  let server: Server;
  let baseUrl = '';
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      // Porta 0 permite escolher porta livre do sistema operacional dinamicamente
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    for (const id of createdProjectIds) {
      const pDir = getProjectDir(id);
      if (fs.existsSync(pDir)) {
        fs.rmSync(pDir, { recursive: true, force: true });
      }
    }
  });

  it('GET /api/health responde 200 com status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.service).toBe('fabrica-de-bermudas-2');
  });

  it('GET /api/doctor responde 200 com diagnóstico das ferramentas', async () => {
    const res = await fetch(`${baseUrl}/api/doctor`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.node.installed).toBe(true);
    expect(json.ffmpeg.installed).toBe(true);
    expect(json.ffprobe.installed).toBe(true);
  });

  it('POST /api/projects cria novo projeto e GET /api/projects lista ele', async () => {
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Episódio API Teste',
        scriptText: 'Eu sentei no sofá pra descansar.\n\nPeguei o celular pra olhar a hora.',
      }),
    });

    expect(createRes.status).toBe(201);
    const createdMeta = await createRes.json();
    expect(createdMeta.projectId).toMatch(/^proj-/);
    createdProjectIds.push(createdMeta.projectId);

    // Listar projetos
    const listRes = await fetch(`${baseUrl}/api/projects`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((p: { projectId: string }) => p.projectId === createdMeta.projectId)).toBe(true);

    // Obter detalhes
    const getRes = await fetch(`${baseUrl}/api/projects/${createdMeta.projectId}`);
    expect(getRes.status).toBe(200);
    const project = await getRes.json();
    expect(project.meta.title).toBe('Episódio API Teste');
    expect(project.scriptText).toContain('Eu sentei no sofá');
  });

  it('PUT /api/projects/:id/plan atualiza plano e POST /api/projects/:id/approve conclui revisão', async () => {
    // 1. Criar projeto
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Projeto Revisão API',
        scriptText: 'Cena única para teste de atualização de plano.',
      }),
    });
    const meta = await createRes.json();
    createdProjectIds.push(meta.projectId);

    // 2. Atualizar plano
    const dummyPlan = {
      schemaVersion: '1.0',
      scriptRevisionId: 'rev-api',
      rigVersion: '1.0.0',
      scenes: [
        {
          sceneId: 'scene-1',
          startChar: 0,
          endChar: 46,
          shots: [
            {
              shotId: 'shot-1',
              setId: 'studio',
              camera: 'medium',
              actions: [{ actionId: 'point' }],
            },
          ],
        },
      ],
    };

    const updateRes = await fetch(`${baseUrl}/api/projects/${meta.projectId}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dummyPlan),
    });
    expect(updateRes.status).toBe(200);

    // 3. Aprovar revisão
    const approveRes = await fetch(`${baseUrl}/api/projects/${meta.projectId}/approve`, {
      method: 'POST',
    });
    expect(approveRes.status).toBe(200);
    const approvedMeta = await approveRes.json();
    expect(approvedMeta.status).toBe('completed');
  });
});
