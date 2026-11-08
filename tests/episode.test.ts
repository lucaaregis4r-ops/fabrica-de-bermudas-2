import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadSarueRig, planScenes, validatePlanAgainstCatalog, parseScriptScenes } from '../src/server/director.js';

describe('Roteiro Completo do Episódio e Direção Generalizada (Sprint 5)', () => {
  const rig = loadSarueRig();
  const episodeFixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'episode.txt');

  it('lê e divide corretamente as 8 cenas do roteiro oficial "Quando foi que descansar virou atraso?"', () => {
    expect(fs.existsSync(episodeFixturePath)).toBe(true);
    const content = fs.readFileSync(episodeFixturePath, 'utf-8');
    const blocks = parseScriptScenes(content);

    expect(blocks.length).toBe(8);
    expect(blocks[0].text).toContain('Eu sentei no sofá pra descansar');
    expect(blocks[1].text).toContain('Peguei o celular pra olhar a hora');
    expect(blocks[2].text).toContain('Aí coloquei um cronômetro de dez minutos');
    expect(blocks[3].text).toContain('E a cabeça já tava na terça-feira');
    expect(blocks[4].text).toContain('O engraçado é que ninguém tinha me cobrado nada');
    expect(blocks[5].text).toContain('Outro dia eu fui ver um jogo com um amigo');
    expect(blocks[6].text).toContain('Quando cheguei em casa, deixei o celular longe do sofá');
    expect(blocks[7].text).toContain('Hoje eu ainda pego o celular sem pensar');
  });

  it('gera plano de direção com ações e cenários variados para o episódio completo', async () => {
    const content = fs.readFileSync(episodeFixturePath, 'utf-8');
    const plan = await planScenes(content, rig, { provider: 'mock' });

    expect(plan.schemaVersion).toBe('1.0');
    expect(plan.scenes.length).toBe(8);

    // Valida 100% contra catálogo
    expect(() => validatePlanAgainstCatalog(plan, content, rig)).not.toThrow();

    // Coleta todas as ações aplicadas no episódio
    const allActions = new Set<string>();
    const allSets = new Set<string>();
    const allProps = new Set<string>();

    for (const scene of plan.scenes) {
      for (const shot of scene.shots) {
        allSets.add(shot.setId);
        for (const action of shot.actions) {
          allActions.add(action.actionId);
          if (action.target) allProps.add(action.target);
        }
      }
    }

    // Confirma diversidade de atuação editorial (não repete os mesmos gestos em tudo)
    expect(allActions.size).toBeGreaterThanOrEqual(4);
    expect(allActions.has('tired') || allActions.has('relax')).toBe(true);
    expect(allActions.has('pick_up_phone') || allActions.has('show_prop')).toBe(true);
    expect(allActions.has('raise_brow') || allActions.has('point')).toBe(true);

    // Confirma diversidade de cenários e objetos
    expect(allSets.has('living_room_sofa') || allSets.has('sports_court')).toBe(true);
    expect(allProps.has('phone')).toBe(true);
    expect(allProps.has('timer')).toBe(true);
  });

  it('comprova generalização da direção em um segundo roteiro arbitrário de 3 parágrafos', async () => {
    const secondScript = `Acordei mais cedo hoje pra organizar as coisas antes da reunião começar.
    
Abri o caderno de anotações pra listar as pendências mais urgentes do dia.
    
No fim da tarde, fui caminhar um pouco na quadra do bairro pra respirar ar puro.`;

    const plan = await planScenes(secondScript, rig, { provider: 'mock' });

    expect(plan.scenes.length).toBe(3);
    expect(() => validatePlanAgainstCatalog(plan, secondScript, rig)).not.toThrow();

    // Cena 2 menciona caderno -> deve relacionar ao caderno ou apontamento
    const scene2 = plan.scenes[1];
    expect(
      scene2.shots.some((s) => s.actions.some((a) => a.target === 'notebook' || a.actionId === 'point'))
    ).toBe(true);

    // Cena 3 menciona quadra -> deve associar ao cenário de quadra ou relaxamento
    const scene3 = plan.scenes[2];
    expect(
      scene3.shots.some((s) => s.setId === 'sports_court' || s.actions.some((a) => a.actionId === 'relax'))
    ).toBe(true);
  });
});
