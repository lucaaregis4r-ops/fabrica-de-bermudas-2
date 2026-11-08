import { generateDoctorReport } from '../src/server/doctor.js';

function main() {
  console.log('====================================================');
  console.log('       FÁBRICA DE BERMUDAS 2.0 - DOCTOR             ');
  console.log('====================================================\n');

  const report = generateDoctorReport();

  const printTool = (tool: { name: string; installed: boolean; version?: string; path?: string; error?: string; recommendation?: string }) => {
    const symbol = tool.installed && !tool.error ? '✓' : '✗';
    console.log(`${symbol} ${tool.name}`);
    if (tool.path) console.log(`    Caminho: ${tool.path}`);
    if (tool.version) console.log(`    Versão:  ${tool.version}`);
    if (tool.error) console.log(`    Erro:    ${tool.error}`);
    if (tool.recommendation) console.log(`    Ação:    ${tool.recommendation}`);
  };

  console.log('[1] Ferramentas do Sistema:');
  printTool(report.node);
  printTool(report.ffmpeg);
  printTool(report.ffprobe);
  printTool(report.storageWritable);
  printTool(report.browser);

  console.log('\n[2] Status da Configuração Antiga (config.toml):');
  const cfg = report.legacyConfig;
  const cfgSymbol = cfg.found && cfg.readable ? '✓' : (cfg.found ? '!' : 'i');
  console.log(`${cfgSymbol} Status: ${cfg.message}`);
  console.log(`    Origem:            ${cfg.source}`);
  if (cfg.resolvedPath) {
    console.log(`    Caminho:           ${cfg.resolvedPath}`);
  }
  console.log(`    Diretor de Cena:   ${cfg.directorProvider ?? 'Nenhum'} (Configurado: ${cfg.directorConfigured ? 'Sim' : 'Não'}, Suportado: ${cfg.directorSupported ? 'Sim' : 'Não'})`);
  console.log(`    Síntese de Voz:    ${cfg.ttsProvider ?? 'Nenhum'} (Configurado: ${cfg.ttsConfigured ? 'Sim' : 'Não'})`);

  console.log('\n----------------------------------------------------');
  if (report.allRequiredOk) {
    console.log(`RESULTADO: TUDO CERTO!`);
    console.log(report.summary);
  } else {
    console.log(`RESULTADO: ATENÇÃO NECESSÁRIA!`);
    console.log(report.summary);
    process.exit(1);
  }
  console.log('====================================================\n');
}

main();
