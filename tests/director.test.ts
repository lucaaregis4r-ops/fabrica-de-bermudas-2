import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseScriptScenes,
  validatePlanAgainstCatalog,
  generateDeterministicStoryboard,
  planScenes,
  loadSarueRig,
  DirectorError,
} from '../src/server/director.js';
import type { ScenePlan } from '../src/shared/contracts.js';

describe('Direção Automática de Cenas (Sprint 4)', () => {
  const rig = loadSarueRig();

  it('preserva literalidade exata de caracteres incluindo acentos e emojis', () => {
    const rawScript = 'Olá, mundo! 🐒 Vamos descansar no sofá.\n\nAí peguei o celular 📱 às 10:00.';
    const blocks = parseScriptScenes(rawScript);

    expect(blocks.length).toBe(2);
    expect(blocks[0].sceneId).toBe('scene-1');
    expect(blocks[0].text).toBe('Olá, mundo! 🐒 Vamos descansar no sofá.');
    expect(rawScript.slice(blocks[0].startChar, blocks[0].endChar)).toBe(blocks[0].text);

    expect(blocks[1].sceneId).toBe('scene-2');
    expect(blocks[1].text).toBe('Aí peguei o celular 📱 às 10:00.');
    expect(rawScript.slice(blocks[1].startChar, blocks[1].endChar)).toBe(blocks[1].text);
  });

  it('detecta e rejeita gesto ou ação inexistente fora do catálogo do rig', () => {
    const script = 'Texto simples para teste de validação de catálogo.';
    const invalidPlan: ScenePlan = {
      schemaVersion: '1.0',
      scriptRevisionId: 'rev-test',
      rigVersion: rig.version,
      scenes: [
        {
          sceneId: 'scene-1',
          startChar: 0,
          endChar: script.length,
          shots: [
            {
              shotId: 'shot-1',
              setId: 'studio',
              camera: 'medium',
              actions: [
                { actionId: 'gesto_voador_inexistente' },
              ],
            },
          ],
        },
      ],
    };

    expect(() => validatePlanAgainstCatalog(invalidPlan, script, rig)).toThrowError(DirectorError);
    expect(() => validatePlanAgainstCatalog(invalidPlan, script, rig)).toThrow(/não existe no catálogo de ações/);
  });

  it('rejeita cenário (setId) ou prop que não constam no catálogo do rig', () => {
    const script = 'Texto simples de teste.';
    const invalidSetPlan: ScenePlan = {
      schemaVersion: '1.0',
      scriptRevisionId: 'rev-test',
      rigVersion: rig.version,
      scenes: [
        {
          sceneId: 'scene-1',
          startChar: 0,
          endChar: script.length,
          shots: [
            {
              shotId: 'shot-1',
              setId: 'praia_tropical_inexistente',
              camera: 'medium',
              actions: [{ actionId: 'idle' }],
            },
          ],
        },
      ],
    };

    expect(() => validatePlanAgainstCatalog(invalidSetPlan, script, rig)).toThrowError(DirectorError);
    expect(() => validatePlanAgainstCatalog(invalidSetPlan, script, rig)).toThrow(/Cenário 'praia_tropical_inexistente'/);
  });

  it('rejeita âncora fora da fala da cena quando strictAnchors está ativo', () => {
    const script = 'Cena que fala apenas de futebol e amigos.';
    const invalidAnchorPlan: ScenePlan = {
      schemaVersion: '1.0',
      scriptRevisionId: 'rev-test',
      rigVersion: rig.version,
      scenes: [
        {
          sceneId: 'scene-1',
          startChar: 0,
          endChar: script.length,
          shots: [
            {
              shotId: 'shot-1',
              setId: 'studio',
              camera: 'medium',
              actions: [
                { actionId: 'point', anchorText: 'palavra_que_nao_existe' },
              ],
            },
          ],
        },
      ],
    };

    expect(() =>
      validatePlanAgainstCatalog(invalidAnchorPlan, script, rig, { strictAnchors: true })
    ).toThrowError(DirectorError);
    expect(() =>
      validatePlanAgainstCatalog(invalidAnchorPlan, script, rig, { strictAnchors: true })
    ).toThrow(/Âncora de texto "palavra_que_nao_existe" não encontrada/);
  });

  it('gera storyboard determinístico inteligente e válido contra o rig', async () => {
    const pilotFixture = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'pilot.txt'), 'utf-8');
    const plan = await planScenes(pilotFixture, rig, { provider: 'mock' });

    expect(plan.schemaVersion).toBe('1.0');
    expect(plan.scenes.length).toBe(2);

    // Cena 1 (celular)
    const scene1 = plan.scenes[0];
    expect(scene1.shots.some((s) => s.actions.some((a) => a.actionId === 'pick_up_phone'))).toBe(true);

    // Cena 2 (cronômetro)
    const scene2 = plan.scenes[1];
    expect(scene2.shots.some((s) => s.actions.some((a) => a.target === 'timer'))).toBe(true);

    // Deve validar 100% contra o catálogo
    expect(() => validatePlanAgainstCatalog(plan, pilotFixture, rig)).not.toThrow();
  });

  it('distingue configuração ausente (CONFIG_MISSING) de autenticação rejeitada (AUTH_FAILED)', async () => {
    // 1. Provedor gemini sem API key e com fallback desativado
    await expect(
      planScenes('Texto qualquer', rig, {
        provider: 'gemini',
        apiKey: '',
        fallbackToLocalStoryboard: false,
      })
    ).rejects.toMatchObject({
      code: 'CONFIG_MISSING',
    });

    // 2. Provedor gemini com API key rejeitada pelo servidor (mock do fetch com status 403)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden: API key not valid',
    } as unknown as Response);

    try {
      await expect(
        planScenes('Texto qualquer', rig, {
          provider: 'gemini',
          apiKey: 'chave_invalida_rejeitada_123',
          fallbackToLocalStoryboard: false,
        })
      ).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('aciona tentativa de reparo quando a primeira resposta do provedor for JSON inválido', async () => {
    const script = 'Primeira cena de teste.';
    const validPlanJson = JSON.stringify({
      schemaVersion: '1.0',
      scriptRevisionId: 'rev-repaired',
      rigVersion: rig.version,
      scenes: [
        {
          sceneId: 'scene-1',
          startChar: 0,
          endChar: script.length,
          shots: [
            {
              shotId: 'shot-1',
              setId: 'studio',
              camera: 'medium',
              actions: [{ actionId: 'idle' }],
            },
          ],
        },
      ],
    });

    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Primeira resposta quebrada
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'RESPOSTA_CORROMPIDA_NAO_JSON' }] } }],
          }),
        } as unknown as Response;
      }
      // Segunda resposta corrigida (reparo)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: validPlanJson }] } }],
        }),
      } as unknown as Response;
    });

    try {
      const plan = await planScenes(script, rig, {
        provider: 'gemini',
        apiKey: 'fake_key_for_mock',
        allowRepair: true,
      });

      expect(callCount).toBe(2); // Teve 1 tentativa inicial e 1 reparo
      expect(plan.scenes.length).toBe(1);
      expect(plan.scenes[0].sceneId).toBe('scene-1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
