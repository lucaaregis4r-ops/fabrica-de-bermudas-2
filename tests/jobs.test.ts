import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createProject,
  getProject,
  getProjectDir,
  updateProjectPlan,
  executeProjectJob,
} from '../src/server/jobs.js';
import type { VoiceProfile } from '../src/server/voice.js';

describe('Esteira de Jobs e Trabalho Retomável (Sprint 4)', () => {
  const createdProjectIds: string[] = [];

  const mockVoiceProfile: VoiceProfile = {
    voiceKey: 'mock-voice-test',
    provider: 'mock',
  };

  afterAll(() => {
    // Limpeza dos projetos de teste criados
    for (const id of createdProjectIds) {
      const pDir = getProjectDir(id);
      if (fs.existsSync(pDir)) {
        fs.rmSync(pDir, { recursive: true, force: true });
      }
    }
  });

  it('cria estrutura atômica de projeto em storage/projects/<id>', () => {
    const script = 'Peguei o celular pra olhar a hora.\n\nAí coloquei um cronômetro de dez minutos.';
    const meta = createProject({
      title: 'Projeto Piloto Teste',
      scriptText: script,
    });
    createdProjectIds.push(meta.projectId);

    expect(meta.projectId).toMatch(/^proj-/);
    expect(meta.status).toBe('draft');

    const projectDir = getProjectDir(meta.projectId);
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'meta.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'script.txt'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'audio'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'output'))).toBe(true);

    const projectData = getProject(meta.projectId);
    expect(projectData.meta.title).toBe('Projeto Piloto Teste');
    expect(projectData.scriptText).toBe(script);
    expect(projectData.plan).toBeUndefined();
  });

  it('simula interrupção no planejamento e retomada na síntese de voz', async () => {
    const script = 'Eu sentei no sofá pra descansar.\n\nPeguei o celular pra olhar a hora.';
    const meta = createProject({
      title: 'Projeto Retomável',
      scriptText: script,
    });
    createdProjectIds.push(meta.projectId);

    // Passo 1: Executa apenas até o estágio 'plan' (simulando que o processo parou aqui)
    const planResult = await executeProjectJob(meta.projectId, {
      targetStep: 'plan',
      planOptions: { provider: 'mock' },
    });

    expect(planResult.status).toBe('planned');
    expect(planResult.plan).toBeDefined();
    expect(planResult.plan?.scenes.length).toBe(2);

    const check1 = getProject(meta.projectId);
    expect(check1.meta.status).toBe('planned');
    expect(check1.plan).toBeDefined();
    expect(check1.timelines).toBeUndefined();

    // Passo 2: Retoma a execução a partir do projeto existente
    const fullResult = await executeProjectJob(meta.projectId, {
      targetStep: 'all',
      voiceProfile: mockVoiceProfile,
    });

    expect(fullResult.resumedFromStep).toBe('voice');
    expect(fullResult.status).toBe('ready');
    expect(fullResult.timelines?.length).toBe(2);
    expect(fullResult.srt).toContain('-->');
    expect(fullResult.durationSeconds).toBeGreaterThan(0);

    const check2 = getProject(meta.projectId);
    expect(check2.meta.status).toBe('ready');
    expect(check2.timelines?.length).toBe(2);
    expect(check2.srt).toBeDefined();
  });

  it('preserva cache de voz ao alterar apenas o gesto/ação visual de uma cena', async () => {
    const script = 'Aí coloquei um cronômetro de dez minutos. Até pra parar eu inventei um jeito de me fiscalizar.';
    const meta = createProject({
      title: 'Projeto Cache de Voz',
      scriptText: script,
    });
    createdProjectIds.push(meta.projectId);

    // 1. Executa primeira rodada completa
    const firstResult = await executeProjectJob(meta.projectId, {
      targetStep: 'all',
      planOptions: { provider: 'mock' },
      voiceProfile: mockVoiceProfile,
    });

    expect(firstResult.status).toBe('ready');
    expect(firstResult.plan).toBeDefined();

    const projectDir = getProjectDir(meta.projectId);
    const audioDir = path.join(projectDir, 'audio');
    const wavFiles = fs.readdirSync(audioDir).filter((f) => f.endsWith('.wav'));
    expect(wavFiles.length).toBeGreaterThan(0);

    // Registra carimbo de data/hora (mtimeMs) dos arquivos de áudio gerados
    const initialMtimes: Record<string, number> = {};
    for (const f of wavFiles) {
      initialMtimes[f] = fs.statSync(path.join(audioDir, f)).mtimeMs;
    }

    // 2. Modifica apenas uma ação visual no plano (ex: altera idle para raise_brow na cena 1)
    const modifiedPlan = JSON.parse(JSON.stringify(firstResult.plan!));
    modifiedPlan.scenes[0].shots[0].actions[0].actionId = 'raise_brow';
    updateProjectPlan(meta.projectId, modifiedPlan);

    // Pequena pausa para garantir que qualquer modificação de arquivo teria mtimeMs diferente
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 3. Reexecuta a esteira após alteração visual
    const secondResult = await executeProjectJob(meta.projectId, {
      targetStep: 'all',
      voiceProfile: mockVoiceProfile,
    });

    expect(secondResult.status).toBe('ready');

    // 4. Confirma que a nova ação visual foi aplicada na timeline
    expect(
      secondResult.timelines?.[0].actions.some((a) => a.actionId === 'raise_brow')
    ).toBe(true);

    // 5. Confirma que os áudios individuais NÃO foram regerados (cache preservado!)
    for (const f of wavFiles) {
      if (f.startsWith('take_')) {
        const currentMtime = fs.statSync(path.join(audioDir, f)).mtimeMs;
        expect(currentMtime).toBe(initialMtimes[f]);
      }
    }
  });
});
