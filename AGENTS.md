# Diretrizes para Agentes de IA — Fábrica de Bermudas 2.0

Este documento serve como guia de continuidade para agentes e desenvolvedores trabalhando no projeto Fábrica de Bermudas 2.0.

## Visão do Projeto
A Fábrica de Bermudas 2.0 é um estúdio de produção de vídeos curtos verticais (Shorts/Reels) com o personagem **Saruê** (gambá estilizado de boné, óculos escuros e corrente de ouro), voz em português brasileiro, legendas sincronizadas e atuação 2D em SVG gerada proceduralmente.

O projeto é voltado para execução local em hardware modesto (Dell Inspiron 5458, Linux Mint, 8 GB RAM, HD mecânico).

## Regras de Arquitetura e Código

1. **Proteção Rigorosa de Segredos:**
   - NUNCA exponha credenciais, chaves de API (`GEMINI_API_KEY`, etc.) ou conteúdos brutos de `config.toml` em logs de terminal, respostas no chat, atributos de frontend ou arquivos versionados pelo Git.
   - O `config.toml` legado da fábrica antiga é lido **exclusivamente em modo somente leitura** e em memória pelo backend (`src/server/config.ts`).
   - O vínculo com a fábrica antiga só registra o caminho do arquivo em `storage/local-settings.json`.

2. **Caminhos com Espaços e Acentos:**
   - A pasta do projeto contém espaços e caracteres acentuados (`Área de trabalho/Projetos/Backup/Fabrica de bermudas 2.0`).
   - Todos os processos externos (`ffmpeg`, `ffprobe`, etc.) devem ser invocados com arrays de argumentos explícitos (`execFile` ou `execFileSync`), nunca concatenados diretamente em strings de shell sem tratamento.

3. **Renderização de Vídeo e Remotion:**
   - O formato padrão é vertical 9:16: prévias em `360 × 640` e final em `720 × 1280`, sempre a `24 fps`.
   - Limitar concorrência de render a 1 (`concurrency: 1`) para evitar sobrecarga de memória no Dell com 8 GB de RAM.
   - Evitar re-renderizar cenas que não sofreram alterações (reaproveitar cache de áudio e takes visuais).

4. **Contratos e Schemas:**
   - Todas as entidades compartilhadas residem em `src/shared/contracts.ts` e utilizam Zod para validação em runtime.
   - Qualquer nova alteração nos dados do roteiro, planos ou timeline deve respeitar as regras de imutabilidade da narração aprovada.

## Comandos Principais

- `npm run doctor`: Diagnóstico do ambiente e verificação das ferramentas necessárias.
- `npm run config:link -- "/caminho/para/config.toml"`: Vincula o `config.toml` antigo.
- `npm run render:diagnostic`: Gera o cartão MP4 de 2 segundos para testar a renderização local.
- `npm test`: Executa os testes unitários com Vitest.
- `npm run typecheck`: Executa a validação de tipos TypeScript (`tsc --noEmit`).
- `npm run dev`: Inicia o backend Express e o frontend Vite em paralelo.
