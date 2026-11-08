import fs from 'node:fs';
import path from 'node:path';
import { writeLocalSettings, inspectLegacyConfigStatus, readAllowedLegacyFields } from '../src/server/config.js';

function main() {
  const args = process.argv.slice(2);
  const targetPathArg = args[0];

  if (!targetPathArg) {
    console.error('Uso: npm run config:link -- "/caminho/para/a/fabrica-antiga/config.toml"');
    console.log('\nStatus atual:');
    const status = inspectLegacyConfigStatus();
    console.log(`- Localização: ${status.resolvedPath ?? 'Nenhum'}`);
    console.log(`- Origem: ${status.source}`);
    console.log(`- Legível: ${status.readable ? 'Sim' : 'Não'}`);
    console.log(`- Mensagem: ${status.message}`);
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), targetPathArg);

  if (!fs.existsSync(resolved)) {
    console.error(`Erro: Arquivo não encontrado no caminho: "${resolved}"`);
    process.exit(1);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    console.error(`Erro: O caminho informado não é um arquivo: "${resolved}"`);
    process.exit(1);
  }

  const check = readAllowedLegacyFields(resolved);
  if (check.error) {
    console.warn(`Aviso ao ler TOML: ${check.error}`);
  }

  // Salvar o caminho nas configurações locais (fora do Git)
  writeLocalSettings({ legacyConfigPath: resolved });

  console.log(`✓ Vínculo estabelecido com sucesso!`);
  console.log(`  Arquivo: ${resolved}`);
  console.log(`  Armazenado em: storage/local-settings.json (ignorado no Git)`);

  const status = inspectLegacyConfigStatus();
  console.log(`\nDiagnóstico da configuração vinculada:`);
  console.log(`- Provedor do Diretor: ${status.directorProvider ?? 'Nenhum'} (Configurado: ${status.directorConfigured ? 'Sim' : 'Não'})`);
  console.log(`- Provedor de Voz: ${status.ttsProvider ?? 'Nenhum'} (Configurado: ${status.ttsConfigured ? 'Sim' : 'Não'})`);
}

main();
