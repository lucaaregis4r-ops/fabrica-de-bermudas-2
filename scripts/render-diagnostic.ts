import path from 'node:path';
import { renderVideo } from '../src/server/render.js';

async function main() {
  console.log('====================================================');
  console.log('   FÁBRICA DE BERMUDAS 2.0 - RENDER DE DIAGNÓSTICO   ');
  console.log('====================================================\n');

  const outputPath = path.join(process.cwd(), 'storage', 'diagnostics', 'diagnostic_card.mp4');
  console.log(`Iniciando renderização do cartão de teste (2 segundos / 48 quadros)...`);
  console.log(`Destino: ${outputPath}`);

  const start = Date.now();

  try {
    const inspection = await renderVideo({
      compositionId: 'DiagnosticCard',
      outputPath,
      concurrency: 1,
    });

    const elapsedSec = ((Date.now() - start) / 1000).toFixed(2);

    console.log('\n✓ Renderização concluída com sucesso!');
    console.log(`Tempo de processamento: ${elapsedSec}s`);
    console.log('\nResultados da inspeção com ffprobe:');
    console.log(`- Arquivo:          ${inspection.filePath}`);
    console.log(`- Resolução:        ${inspection.width} × ${inspection.height} (Vertical 9:16)`);
    console.log(`- Codec de Vídeo:   ${inspection.codec} (H.264)`);
    console.log(`- Taxa de Quadros:  ${inspection.fps} fps`);
    console.log(`- Duração:          ${inspection.durationSeconds.toFixed(2)} segundos`);
    console.log(`- Total de Quadros: ${inspection.frameCount} quadros`);
    console.log(`- Tamanho:          ${(inspection.fileSizeBytes / 1024).toFixed(1)} KB`);
    console.log('\n====================================================\n');
  } catch (err) {
    console.error('\n✗ Falha na renderização de diagnóstico:');
    console.error(err);
    process.exit(1);
  }
}

main();
