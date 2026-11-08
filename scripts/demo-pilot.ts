import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderVideo, inspectVideoWithFfprobe } from '../src/server/render.js';

async function main() {
  console.log('====================================================');
  console.log('       FÁBRICA DE BERMUDAS 2.0 - PILOTO DO SARUÊ    ');
  console.log('                 (SPRINT 2 DEMO)                    ');
  console.log('====================================================\n');

  const rawVideoPath = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_raw.mp4');
  const finalVideoPath = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_demo.mp4');
  const testAudioPath = path.join(process.cwd(), 'storage', 'diagnostics', 'pilot_test_audio.aac');

  // Garante que o áudio de teste de 16 segundos exista
  if (!fs.existsSync(testAudioPath)) {
    console.log('Gerando faixa de áudio de teste com ritmo narrativo...');
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=220:duration=16',
      '-af', 'volume=0.15',
      '-c:a', 'aac',
      testAudioPath,
    ]);
  }

  console.log('Iniciando renderização do Piloto do Saruê:');
  console.log('- Roteiro: Cenas 2 e 3 ("Peguei o celular..." e "Aí coloquei um cronômetro...")');
  console.log('- Total de quadros: 384 quadros (16.0s a 24 fps)');
  console.log('- Formato: 720 × 1280 vertical (9:16)');
  console.log('- Concorrência: 1 (otimizado para 8 GB RAM no Dell)');
  console.log(`- Destino: ${finalVideoPath}\n`);

  const memStart = process.memoryUsage();
  const startTime = Date.now();

  try {
    // 1. Renderiza o vídeo via Remotion
    console.log('-> Renderizando quadros SVG do rig do Saruê...');
    await renderVideo({
      compositionId: 'PilotDemo',
      outputPath: rawVideoPath,
      concurrency: 1,
    });

    // 2. Muxing do áudio de teste com o vídeo gerado
    console.log('-> Acoplando faixa de áudio de teste via FFmpeg...');
    execFileSync('ffmpeg', [
      '-y',
      '-i', rawVideoPath,
      '-i', testAudioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      finalVideoPath,
    ]);

    // Limpa o temporário sem áudio
    if (fs.existsSync(rawVideoPath)) {
      fs.unlinkSync(rawVideoPath);
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    const memEnd = process.memoryUsage();
    const heapUsedMB = ((memEnd.heapUsed - memStart.heapUsed) / (1024 * 1024)).toFixed(1);

    // 3. Inspeção completa com ffprobe
    const inspection = inspectVideoWithFfprobe(finalVideoPath);

    console.log('\n✓ Piloto renderizado e validado com sucesso!');
    console.log('====================================================');
    console.log('Métricas de Desempenho no Hardware Local:');
    console.log(`- Tempo Total de Render:  ${elapsedSeconds}s`);
    console.log(`- Delta de Memória Heap:  ${heapUsedMB} MB`);
    console.log(`- Arquivo Final:          ${inspection.filePath}`);
    console.log(`- Resolução:              ${inspection.width} × ${inspection.height} (Vertical 9:16)`);
    console.log(`- Codec de Vídeo:         ${inspection.codec} (H.264)`);
    console.log(`- Taxa de Quadros:        ${inspection.fps} fps`);
    console.log(`- Duração Total:          ${inspection.durationSeconds.toFixed(2)} segundos`);
    console.log(`- Total de Quadros:       ${inspection.frameCount} quadros`);
    console.log(`- Tamanho do Arquivo:     ${(inspection.fileSizeBytes / 1024).toFixed(1)} KB`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n✗ Erro na renderização do Piloto:');
    console.error(err);
    process.exit(1);
  }
}

main();
