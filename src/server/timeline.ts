import fs from 'node:fs';
import type {
  ScenePlanItem,
  VoiceTake,
  SceneTimeline,
  CaptionCue,
  MouthCue,
  ActionCue,
} from '../shared/contracts.js';
import { measureAudioDurationMs } from './voice.js';

/**
 * Converte milissegundos para o formato de tempo SRT (HH:MM:SS,mmm)
 */
export function formatSrtTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

/**
 * Gera arquivo SRT padrão a partir de uma timeline de cena ou lista de timelines
 */
export function generateSrt(timelines: SceneTimeline | SceneTimeline[]): string {
  const list = Array.isArray(timelines) ? timelines : [timelines];
  let srt = '';
  let counter = 1;
  let cumulativeMs = 0;

  for (const timeline of list) {
    const fps = timeline.fps || 24;
    for (const caption of timeline.captions) {
      const startMs = cumulativeMs + Math.round((caption.startFrame / fps) * 1000);
      const endMs = cumulativeMs + Math.round((caption.endFrame / fps) * 1000);

      srt += `${counter}\n`;
      srt += `${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n`;
      srt += `${caption.text}\n\n`;
      counter++;
    }
    cumulativeMs += Math.round((timeline.frameCount / fps) * 1000);
  }

  return srt.trim() + '\n';
}

/**
 * Compila a timeline final da cena integrando o plano visual e o áudio da voz sintetizada
 */
export function compileTimeline(
  plan: ScenePlanItem,
  voiceTake: VoiceTake,
  fps = 24
): SceneTimeline {
  if (fps !== 24) {
    throw new Error('A taxa de quadros (fps) da Fábrica de Bermudas deve ser estritamente 24 fps.');
  }

  if (!fs.existsSync(voiceTake.audioPath)) {
    throw new Error(`Arquivo de áudio da cena não encontrado: "${voiceTake.audioPath}"`);
  }

  // Mede duração real via ffprobe para garantir precisão exata do áudio gravado
  const measuredMs = measureAudioDurationMs(voiceTake.audioPath);
  const effectiveDurationMs = Math.max(voiceTake.durationMs, measuredMs);
  const frameCount = Math.ceil((effectiveDurationMs / 1000) * fps);

  if (frameCount <= 0) {
    throw new Error(`Duração do áudio para a cena ${plan.sceneId} é inválida (${effectiveDurationMs}ms).`);
  }

  // 1. Gera legendas sincronizadas (captions) a partir das marcas de fala
  const captions: CaptionCue[] = voiceTake.marks.map((mark) => {
    const startFrame = Math.round((mark.startMs / 1000) * fps);
    const endFrame = Math.min(frameCount, Math.max(startFrame + 1, Math.round((mark.endMs / 1000) * fps)));
    return {
      startFrame,
      endFrame,
      text: mark.text,
    };
  });

  // 2. Mapeia âncoras de texto dos planos e ações para quadros exatos
  const actions: ActionCue[] = [];
  for (const shot of plan.shots) {
    for (const action of shot.actions) {
      let startFrame = 0;
      let durationFrames = action.durationFrames ?? 72;

      if (action.anchorText) {
        // Encontra a marca de fala que contém a palavra âncora
        const matchingMark = voiceTake.marks.find((m) =>
          m.text.toLowerCase().includes(action.anchorText!.toLowerCase())
        );
        if (matchingMark) {
          startFrame = Math.round((matchingMark.startMs / 1000) * fps);
        }
      }

      actions.push({
        actionId: action.actionId,
        target: action.target,
        anchorText: action.anchorText,
        startFrame,
        durationFrames: Math.min(durationFrames, frameCount - startFrame),
      });
    }
  }

  // 3. Gera sincronismo labial (mouth cues) quadro a quadro:
  // - Aberta/fechada durante a fala (ritmo de sílabas)
  // - Fechada estritamente nas pausas entre frases e após o término da fala
  const mouthCues: MouthCue[] = [];
  for (let f = 0; f < frameCount; f++) {
    // Checa se o frame atual está dentro de algum bloco falado (mark)
    const isInsideSpeech = voiceTake.marks.some((m) => {
      const startF = Math.round((m.startMs / 1000) * fps);
      const endF = Math.round((m.endMs / 1000) * fps);
      return f >= startF && f <= endF;
    });

    if (isInsideSpeech) {
      // Abre e fecha de forma ritmada durante a emissão vocal
      const mouthState: 'open' | 'closed' = f % 6 < 3 ? 'open' : 'closed';
      mouthCues.push({ frame: f, mouthState });
    } else {
      // Pausa ou silêncio: boca fechada
      mouthCues.push({ frame: f, mouthState: 'closed' });
    }
  }

  return {
    sceneId: plan.sceneId,
    fps: 24,
    frameCount,
    shots: plan.shots,
    actions,
    mouthCues,
    captions,
    audioPath: voiceTake.audioPath,
  };
}
