import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { synthesize, DEFAULT_PIPER_PROFILE } from '../src/server/voice.js';
import { compileTimeline, generateSrt } from '../src/server/timeline.js';
import { renderVideo, inspectVideoWithFfprobe } from '../src/server/render.js';
import { loadSarueRig, planScenes, parseScriptScenes } from '../src/server/director.js';
import { concatAudioFiles } from '../src/server/jobs.js';
import type { SceneTimeline } from '../src/shared/contracts.js';

async function main() {
  const isMock = process.argv.includes('--mock');

  console.log('====================================================');
  console.log('       FÁBRICA DE BERMUDAS 2.0 - EPISÓDIO COMPLETO   ');
  console.log('          "Quando foi que descansar virou atraso?"  ');
  console.log(`      MODO: ${isMock ? 'DIREÇÃO AUTO (MOCK LOCAL)' : 'DIREÇÃO AUTOMÁTICA'}`);
  console.log('====================================================\n');

  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'episode.txt');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Arquivo de roteiro do episódio não encontrado em ${fixturePath}`);
  }
  const fullScript = fs.readFileSync(fixturePath, 'utf-8');
  const rig = loadSarueRig();

  // 1. Planejamento das 8 Cenas via Diretor Automático
  console.log('[1/4] Planejando as 8 cenas com o Diretor Automático (planScenes)...');
  const plan = await planScenes(fullScript, rig, {
    provider: isMock ? 'mock' : 'auto',
    fallbackToLocalStoryboard: true,
  });

  console.log(`  ✓ Roteiro planejado com sucesso: ${plan.scenes.length} cenas configuradas.`);
  for (let i = 0; i < plan.scenes.length; i++) {
    const sc = plan.scenes[i];
    const shotDesc = sc.shots
      .map((s) => `${s.camera} @ ${s.setId} [${s.actions.map((a) => a.actionId).join(',')}]`)
      .join(' -> ');
    console.log(`    Cena ${i + 1}: ${shotDesc}`);
  }

  // 2. Síntese de Voz PT-BR Neural para as 8 Cenas
  console.log('\n[2/4] Sintetizando voz PT-BR das 8 cenas com Piper (modelo Faber neural)...');
  const blocks = parseScriptScenes(fullScript);
  const audioTakes: string[] = [];
  const timelines: SceneTimeline[] = [];

  for (let i = 0; i < plan.scenes.length; i++) {
    const scenePlan = plan.scenes[i];
    const text = blocks[i]?.text || fullScript.slice(scenePlan.startChar, scenePlan.endChar);

    process.stdout.write(`  - Sintetizando Cena ${i + 1}/${plan.scenes.length}... `);
    const take = await synthesize(text, `episode-scene-${i + 1}`, DEFAULT_PIPER_PROFILE, {
      pronunciationMap: { tava: 'estava' },
    });
    audioTakes.push(take.audioPath);

    const timeline = compileTimeline(scenePlan, take, 24);
    timelines.push(timeline);
    console.log(`ok (${(take.durationMs / 1000).toFixed(1)}s, ${timeline.frameCount} quadros)`);
  }

  const totalFrames = timelines.reduce((acc, t) => acc + t.frameCount, 0);
  const totalDurationSec = (totalFrames / 24).toFixed(2);
  console.log(`\n  ✓ Todas as 8 cenas sincronizadas: ${totalFrames} quadros (${totalDurationSec}s a 24 fps)`);

  // 3. Montagem da Trilha Master e Geração do SRT
  console.log('\n[3/4] Montando trilha master de áudio e gerando legendas SRT...');
  const diagnosticsDir = path.join(process.cwd(), 'storage', 'diagnostics');
  if (!fs.existsSync(diagnosticsDir)) {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
  }

  const srtPath = path.join(diagnosticsDir, 'episode_demo.srt');
  const srtContent = generateSrt(timelines);
  fs.writeFileSync(srtPath, srtContent, 'utf-8');
  console.log(`  ✓ Legendas SRT salvas em: ${srtPath}`);

  const masterAudioPath = path.join(diagnosticsDir, 'episode_master_voice.wav');
  concatAudioFiles(audioTakes, masterAudioPath);
  console.log(`  ✓ Áudio master sintetizado em: ${masterAudioPath}`);

  // 4. Renderização com Remotion (720 × 1280 a 24 fps, concurrency: 1)
  console.log('\n[4/4] Renderizando episódio vertical completo via Remotion (concurrency: 1)...');
  const rawVideoPath = path.join(diagnosticsDir, 'episode_raw.mp4');
  const finalVideoPath = path.join(diagnosticsDir, 'episode_demo.mp4');

  const startTime = Date.now();
  await renderVideo({
    compositionId: 'EpisodeDemo',
    outputPath: rawVideoPath,
    inputProps: {
      scenes: timelines,
    },
    concurrency: 1,
  });

  console.log('-> Muxing de vídeo e áudio AAC estéreo via FFmpeg...');
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

  console.log('\n====================================================');
  console.log('   ✓ EPISÓDIO COMPLETO DO SARUÊ RENDERIZADO COM SUCESSO!');
  console.log('====================================================');
  console.log('Relatório Final de Produção Local (Dell Inspiron 5458):');
  console.log(`- Tempo Total de Render:  ${elapsedSec}s`);
  console.log(`- Arquivo MP4:            ${inspection.filePath}`);
  console.log(`- Arquivo de Legendas:    ${srtPath}`);
  console.log(`- Resolução:              ${inspection.width} × ${inspection.height} (Vertical 9:16)`);
  console.log(`- Taxa de Quadros:        ${inspection.fps} fps`);
  console.log(`- Codec de Vídeo:         ${inspection.codec} (H.264)`);
  console.log(`- Duração Total:          ${inspection.durationSeconds.toFixed(2)} segundos`);
  console.log(`- Total de Quadros:       ${inspection.frameCount} quadros`);
  console.log(`- Tamanho do Arquivo:     ${(inspection.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Erro ao renderizar episódio completo:', err);
  process.exit(1);
});
