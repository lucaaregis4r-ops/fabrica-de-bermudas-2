import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { compileTimeline, generateSrt, formatSrtTime } from '../src/server/timeline.js';
import { applyPronunciation, synthesize } from '../src/server/voice.js';
import type { ScenePlanItem, VoiceTake } from '../src/shared/contracts.js';

describe('Compilador de Timeline, Voz e Sincronismo (Sprint 3)', () => {
  const dummyAudioPath = path.join(process.cwd(), 'storage', 'diagnostics', 'test_piper_sample.wav');

  // Garante que haja um arquivo de áudio para os testes
  if (!fs.existsSync(dummyAudioPath)) {
    const dir = path.dirname(dummyAudioPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dummyAudioPath, 'RIFFdummywav', 'utf-8');
  }

  it('cobre uma fala distribuída em dois planos (troca interna de plano)', () => {
    const plan: ScenePlanItem = {
      sceneId: 'scene-1',
      startChar: 0,
      endChar: 70,
      shots: [
        {
          shotId: 'shot-1',
          setId: 'desk',
          camera: 'medium',
          actions: [{ actionId: 'idle' }],
        },
        {
          shotId: 'shot-2',
          setId: 'desk',
          camera: 'close',
          actions: [{ actionId: 'pick_up_phone', target: 'phone', anchorText: 'celular' }],
        },
      ],
    };

    const voiceTake: VoiceTake = {
      sceneId: 'scene-1',
      audioPath: dummyAudioPath,
      durationMs: 4000,
      voiceKey: 'pt_BR-faber-medium',
      timingLevel: 'sentence',
      marks: [
        {
          text: 'Peguei o celular pra olhar a hora.',
          startChar: 0,
          endChar: 34,
          startMs: 0,
          endMs: 1800,
        },
        {
          text: 'Quando vi, eu tava respondendo.',
          startChar: 35,
          endChar: 66,
          startMs: 2200,
          endMs: 3900,
        },
      ],
    };

    const timeline = compileTimeline(plan, voiceTake, 24);

    expect(timeline.sceneId).toBe('scene-1');
    expect(timeline.shots.length).toBe(2);
    expect(timeline.captions.length).toBe(2);
    expect(timeline.actions.some((a) => a.actionId === 'pick_up_phone')).toBe(true);
  });

  it('garante boca estritamente fechada durante pausas e silêncios', () => {
    const plan: ScenePlanItem = {
      sceneId: 'scene-pause',
      startChar: 0,
      endChar: 40,
      shots: [{ shotId: 'shot-1', setId: 'desk', camera: 'medium', actions: [] }],
    };

    const voiceTake: VoiceTake = {
      sceneId: 'scene-pause',
      audioPath: dummyAudioPath,
      durationMs: 5000,
      voiceKey: 'pt_BR-faber-medium',
      timingLevel: 'sentence',
      marks: [
        {
          text: 'Primeira frase.',
          startChar: 0,
          endChar: 15,
          startMs: 0,
          endMs: 1500, // Termina em 1.5s (frame 36 a 24 fps)
        },
        // Pausa entre 1.5s e 3.0s (frames 37 a 71 a 24 fps)
        {
          text: 'Segunda frase.',
          startChar: 16,
          endChar: 30,
          startMs: 3000, // Começa em 3.0s (frame 72 a 24 fps)
          endMs: 4500,
        },
      ],
    };

    const timeline = compileTimeline(plan, voiceTake, 24);

    // No meio da pausa (ex: 2.2 segundos = frame 53) a boca deve estar 'closed'
    const pauseCue = timeline.mouthCues.find((m) => m.frame === 53);
    expect(pauseCue).toBeDefined();
    expect(pauseCue?.mouthState).toBe('closed');

    // Durante a fala (ex: 0.5s = frame 12) a boca deve ter animação
    const speakingCue = timeline.mouthCues.find((m) => m.frame === 12);
    expect(speakingCue).toBeDefined();
    expect(speakingCue?.mouthState).toBe('open');
  });

  it('suporta pronúncia diferente da grafia preservando o texto canônico na legenda', async () => {
    const canonical = 'Eu tava no sofá.';
    const pronunciationMap = { tava: 'estava' };

    const spoken = applyPronunciation(canonical, pronunciationMap);
    expect(spoken).toBe('Eu estava no sofá.');

    // Sintetiza com mock determinístico
    const take = await synthesize(
      'scene-pronounce-test',
      canonical,
      { voiceKey: 'mock', provider: 'mock' },
      { pronunciationMap, forceRegenerate: true }
    );

    // O texto da legenda deve ser estritamente o canônico original
    expect(take.marks[0].text).toBe(canonical);
    expect(take.marks[0].text).not.toContain('estava');
  });

  it('valida cobertura completa até o último frame da timeline', () => {
    const plan: ScenePlanItem = {
      sceneId: 'scene-last-frame',
      startChar: 0,
      endChar: 20,
      shots: [{ shotId: 's1', setId: 'desk', camera: 'medium', actions: [] }],
    };

    const voiceTake: VoiceTake = {
      sceneId: 'scene-last-frame',
      audioPath: dummyAudioPath,
      durationMs: 2500,
      voiceKey: 'pt_BR-faber-medium',
      timingLevel: 'sentence',
      marks: [
        {
          text: 'Última fala.',
          startChar: 0,
          endChar: 12,
          startMs: 0,
          endMs: 2000,
        },
      ],
    };

    const timeline = compileTimeline(plan, voiceTake, 24);
    const expectedFrames = Math.ceil((voiceTake.durationMs / 1000) * 24);

    expect(timeline.frameCount).toBe(expectedFrames);
    expect(timeline.mouthCues.length).toBe(expectedFrames);

    // O último frame deve existir e ter boca fechada após o término da fala
    const lastCue = timeline.mouthCues[expectedFrames - 1];
    expect(lastCue.frame).toBe(expectedFrames - 1);
    expect(lastCue.mouthState).toBe('closed');
  });

  it('lança erro descritivo quando o áudio da cena está ausente', () => {
    const plan: ScenePlanItem = {
      sceneId: 'scene-missing-audio',
      startChar: 0,
      endChar: 20,
      shots: [{ shotId: 's1', setId: 'desk', camera: 'medium', actions: [] }],
    };

    const fakeTake: VoiceTake = {
      sceneId: 'scene-missing-audio',
      audioPath: path.join(process.cwd(), 'storage', 'audio', 'arquivo_fantasma.wav'),
      durationMs: 3000,
      voiceKey: 'piper',
      timingLevel: 'sentence',
      marks: [],
    };

    expect(() => compileTimeline(plan, fakeTake, 24)).toThrow(/Arquivo de áudio da cena não encontrado/);
  });

  it('gera arquivo SRT válido com formatação e tempos acumulados corretos', () => {
    const plan: ScenePlanItem = {
      sceneId: 'scene-srt',
      startChar: 0,
      endChar: 40,
      shots: [{ shotId: 's1', setId: 'desk', camera: 'medium', actions: [] }],
    };

    const voiceTake: VoiceTake = {
      sceneId: 'scene-srt',
      audioPath: dummyAudioPath,
      durationMs: 3000,
      voiceKey: 'piper',
      timingLevel: 'sentence',
      marks: [
        {
          text: 'Fala um do Saruê.',
          startChar: 0,
          endChar: 17,
          startMs: 500,
          endMs: 1800,
        },
      ],
    };

    const timeline = compileTimeline(plan, voiceTake, 24);
    const srt = generateSrt(timeline);

    expect(srt).toContain('1\n');
    expect(srt).toContain('Fala um do Saruê.');
    expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
  });
});
