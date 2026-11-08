import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SceneTimelineSchema } from '../src/shared/contracts.js';
import { PILOT_SCENE_1_TIMELINE, PILOT_SCENE_2_TIMELINE } from '../src/video/PilotDemo.js';

describe('Rig do Saruê e Plano Manual do Piloto (Sprint 2)', () => {
  const rigJsonPath = path.join(process.cwd(), 'assets', 'characters', 'sarue', 'rig.json');
  const pilotFixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'pilot.txt');
  const episodeFixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'episode.txt');

  it('valida especificações do rig.json do Saruê', () => {
    expect(fs.existsSync(rigJsonPath)).toBe(true);
    const raw = fs.readFileSync(rigJsonPath, 'utf-8');
    const rig = JSON.parse(raw);

    expect(rig.characterId).toBe('sarue');
    expect(rig.name).toBe('Saruê');
    expect(Array.isArray(rig.layers)).toBe(true);
    expect(rig.layers.length).toBeGreaterThanOrEqual(10);

    // Valida camadas essenciais descritas no plano
    const layerIds = rig.layers.map((l: { id: string }) => l.id);
    expect(layerIds).toContain('tail');
    expect(layerIds).toContain('torso');
    expect(layerIds).toContain('head');
    expect(layerIds).toContain('sunglasses');
    expect(layerIds).toContain('gold_chain');
    expect(layerIds).toContain('cap');
    expect(layerIds).toContain('brows');
    expect(layerIds).toContain('right_arm');

    // Valida catálogo de ações obrigatórias
    const expectedActions = [
      'idle',
      'blink',
      'raise_brow',
      'pick_up_phone',
      'put_down_phone',
      'show_prop',
      'point',
    ];
    for (const action of expectedActions) {
      expect(rig.supportedActions).toContain(action);
    }

    // Valida props obrigatórios
    expect(rig.supportedProps).toContain('phone');
    expect(rig.supportedProps).toContain('timer');
    expect(rig.supportedProps).toContain('desk');

    // Valida enquadramentos de câmera
    expect(rig.cameras.medium).toBeDefined();
    expect(rig.cameras.close).toBeDefined();
  });

  it('valida timelines das cenas do piloto contra o Schema Zod', () => {
    const validated1 = SceneTimelineSchema.parse(PILOT_SCENE_1_TIMELINE);
    expect(validated1.sceneId).toBe('scene-pilot-1');
    expect(validated1.fps).toBe(24);
    expect(validated1.frameCount).toBe(204);
    // Troca de plano interna na cena 1 (medium -> close)
    expect(validated1.shots.length).toBe(2);
    expect(validated1.shots[0].camera).toBe('medium');
    expect(validated1.shots[1].camera).toBe('close');

    const validated2 = SceneTimelineSchema.parse(PILOT_SCENE_2_TIMELINE);
    expect(validated2.sceneId).toBe('scene-pilot-2');
    expect(validated2.fps).toBe(24);
    expect(validated2.frameCount).toBe(180);
    expect(validated2.shots.length).toBe(2);
    // Ação show_prop com timer
    expect(validated2.actions.some((a) => a.actionId === 'show_prop' && a.target === 'timer')).toBe(true);
    // Ação raise_brow na contradição
    expect(validated2.actions.some((a) => a.actionId === 'raise_brow')).toBe(true);
  });

  it('confirma que as fixtures de roteiro existem e batem com as legendas do piloto', () => {
    expect(fs.existsSync(pilotFixturePath)).toBe(true);
    expect(fs.existsSync(episodeFixturePath)).toBe(true);

    const pilotText = fs.readFileSync(pilotFixturePath, 'utf-8');
    const [para1, para2] = pilotText.split(/\n\s*\n/);

    expect(para1).toContain('Peguei o celular pra olhar a hora');
    expect(para2).toContain('Aí coloquei um cronômetro de dez minutos');

    // Garante que o texto das legendas preserva as falas do roteiro
    const fullCaptionsText = [
      ...PILOT_SCENE_1_TIMELINE.captions.map((c) => c.text),
      ...PILOT_SCENE_2_TIMELINE.captions.map((c) => c.text),
    ].join(' ');

    expect(fullCaptionsText).toContain('Peguei o celular pra olhar a hora');
    expect(fullCaptionsText).toContain('cronômetro de dez minutos');
  });
});
