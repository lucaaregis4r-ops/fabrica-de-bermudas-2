import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { synthesize, DEFAULT_PIPER_PROFILE } from '../src/server/voice.js';
import { compileTimeline, generateSrt } from '../src/server/timeline.js';
import { renderVideo, inspectVideoWithFfprobe } from '../src/server/render.js';
import type { ScenePlanItem } from '../src/shared/contracts.js';

async function main() {
  console.log('====================================================');
  console.log('       FÁBRICA DE BERMUDAS 2.0 - PILOTO DO SARUÊ    ');
  console.log('           (SPRINT 3: VOZ PT-BR & LEGENDAS)         ');
  console.log('====================================================\n');

  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'pilot.txt');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
  const [scene1Text, scene2Text] = fixtureContent.split(/\n\s*\n/);

  console.log('[1/4] Sintetizando voz PT-BR via Piper (Faber neural)...');
  console.log(`- Cena 1: "${scene1Text}"`);
  const take1 = await synthesize('pilot-scene-1', scene1Text, DEFAULT_PIPER_PROFILE, {
    pronunciationMap: { tava: 'estava' }, // Exemplo de fonética suave
  });
  console.log(`  ✓ Cena 1 sintetizada: ${(take1.durationMs / 1000).toFixed(2)}s (${take1.marks.length} blocos de fala)`);

  console.log(`- Cena 2: "${scene2Text}"`);
  const take2 = await synthesize('pilot-scene-2', scene2Text, DEFAULT_PIPER_PROFILE);
  console.log(`  ✓ Cena 2 sintetizada: ${(take2.durationMs / 1000).toFixed(2)}s (${take2.marks.length} blocos de fala)`);

  // Planos manuais de cena
  const plan1: ScenePlanItem = {
    sceneId: 'pilot-scene-1',
    startChar: 0,
    endChar: scene1Text.length,
    shots: [
      {
        shotId: 'shot-1-1',
        setId: 'desk-studio',
        camera: 'medium',
        startAnchor: 'Peguei o celular',
        actions: [{ actionId: 'pick_up_phone', target: 'phone', anchorText: 'celular', durationFrames: 70 }],
      },
      {
        shotId: 'shot-1-2',
        setId: 'desk-studio',
        camera: 'close',
        startAnchor: 'Quando vi',
        actions: [{ actionId: 'blink', durationFrames: 24 }],
      },
    ],
  };

  const plan2: ScenePlanItem = {
    sceneId: 'pilot-scene-2',
    startChar: 0,
    endChar: scene2Text.length,
    shots: [
      {
        shotId: 'shot-2-1',
        setId: 'desk-studio',
        camera: 'medium',
        startAnchor: 'cronômetro',
        actions: [{ actionId: 'show_prop', target: 'timer', anchorText: 'cronômetro', durationFrames: 70 }],
      },
      {
        shotId: 'shot-2-2',
        setId: 'desk-studio',
        camera: 'close',
        startAnchor: 'me fiscalizar',
        actions: [{ actionId: 'raise_brow', durationFrames: 85 }],
      },
    ],
  };

  console.log('\n[2/4] Compilando timelines com sincronia labial e pausas...');
  const timeline1 = compileTimeline(plan1, take1, 24);
  const timeline2 = compileTimeline(plan2, take2, 24);
  const totalFrames = timeline1.frameCount + timeline2.frameCount;
  const totalDurationSec = (totalFrames / 24).toFixed(2);
  console.log(`  ✓ Timeline compilada: ${totalFrames} quadros (${totalDurationSec}s a 24 fps)`);

  // Gera o arquivo de legenda SRT
  const srtPath = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_demo.srt');
  const srtContent = generateSrt([timeline1, timeline2]);
  fs.writeFileSync(srtPath, srtContent, 'utf-8');
  console.log(`  ✓ Legenda SRT gerada em: ${srtPath}`);

  // Concatena as faixas de voz reais em uma faixa mestre
  console.log('\n[3/4] Montando faixa de áudio mestre da voz...');
  const masterAudioPath = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_synthesized_voice.wav');
  const concatList = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_audio_list.txt');
  fs.writeFileSync(concatList, `file '${take1.audioPath}'\nfile '${take2.audioPath}'\n`, 'utf-8');
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', masterAudioPath]);
  fs.unlinkSync(concatList);

  // Renderiza o vídeo do piloto
  console.log('\n[4/4] Renderizando vídeo vertical via Remotion...');
  const rawVideoPath = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_raw.mp4');
  const finalVideoPath = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_demo.mp4');

  const startTime = Date.now();
  await renderVideo({
    compositionId: 'PilotDemo',
    outputPath: rawVideoPath,
    inputProps: {
      scene1: timeline1,
      scene2: timeline2,
    },
    concurrency: 1,
  });

  // Muxing com o áudio sintetizado real
  console.log('-> Muxing de vídeo e voz sintetizada via FFmpeg...');
  execFileSync('ffmpeg', [
    '-y',
    '-i', rawVideoPath,
    '-i', masterAudioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    finalVideoPath,
  ]);

  if (fs.existsSync(rawVideoPath)) {
    fs.unlinkSync(rawVideoPath);
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const inspection = inspectVideoWithFfprobe(finalVideoPath);

  console.log('\n✓ Piloto com Voz e Sincronismo Concluído com Sucesso!');
  console.log('====================================================');
  console.log('Relatório de Mídia e Desempenho Local:');
  console.log(`- Tempo Total de Render:  ${elapsedSec}s`);
  console.log(`- Arquivo MP4:            ${inspection.filePath}`);
  console.log(`- Arquivo SRT:            ${srtPath}`);
  console.log(`- Resolução:              ${inspection.width} × ${inspection.height} (Vertical 9:16)`);
  console.log(`- Codec de Vídeo:         ${inspection.codec} (H.264)`);
  console.log(`- Taxa de Quadros:        ${inspection.fps} fps`);
  console.log(`- Duração Total:          ${inspection.durationSeconds.toFixed(2)} segundos`);
  console.log(`- Total de Quadros:       ${inspection.frameCount} quadros`);
  console.log(`- Tamanho do MP4:         ${(inspection.fileSizeBytes / 1024).toFixed(1)} KB`);
  console.log('====================================================\n');
}

main();
