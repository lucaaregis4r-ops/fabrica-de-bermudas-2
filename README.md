# Fábrica de Bermudas 2.0

Aplicação local de criação e animação 2D de vídeos verticais (Shorts / Reels / TikTok) com roteiro em português, atuação controlada por código do personagem **Saruê**, síntese de voz, sincronização labial, legendas e renderização via Remotion e FFmpeg.

O projeto foi projetado e otimizado para execução local em hardware modesto (Dell Inspiron 5458, Linux Mint, 8 GB de RAM, HD convencional), sem dependência de aceleração gráfica (GPU) para síntese visual.

---

## 🛠️ Tecnologias e Versões Efetivamente Testadas

- **Sistema Operacional:** Linux Mint (Linux x86_64)
- **Node.js:** `v22.23.2` (registrado em `.nvmrc`)
- **npm:** `10.9.8`
- **TypeScript:** `5.8.2`
- **FFmpeg:** `7.0.2-static`
- **ffprobe:** `7.0.2-static`
- **Navegador de Renderização:** Google Chrome `/usr/bin/google-chrome` & Chrome Headless Shell
- **Remotion:** `4.0.247`
- **React / React-DOM:** `18.3.1`
- **Vite:** `6.2.0`
- **Vitest:** `3.0.7`
- **Express:** `4.21.2`
- **Zod:** `3.24.2`
- **smol-toml:** `1.3.1`

---

## 🚀 Como Instalar e Rodar

### 1. Pré-requisitos do Sistema
Caso não tenha o FFmpeg instalado:
```bash
sudo apt update && sudo apt install ffmpeg chromium-browser
```

### 2. Instalação das Dependências
```bash
npm ci
```

### 3. Diagnóstico do Ambiente
O comando `doctor` valida todas as ferramentas de sistema (Node, FFmpeg, ffprobe, permissões de escrita em `storage/`, browser de render) e inspeciona se há uma configuração legada (`config.toml`) vinculada, sem jamais expor dados confidenciais ou chaves de API:
```bash
npm run doctor
```

### 4. Vínculo da Configuração Legada
A Fábrica 2.0 reaproveita as chaves dos provedores compatíveis salvas no `config.toml` da fábrica antiga. O sistema detecta automaticamente pastas irmãs (`geradordevideos`, `fabrica de bermudas`, `fábrica de bermudas`). Se estiver em outro local, use o comando:
```bash
npm run config:link -- "/caminho/para/config.toml"
```
*O comando armazena apenas o caminho em `storage/local-settings.json`, arquivo estritamente ignorado no Git.*

### 5. Renderização do Cartão de Diagnóstico (MP4)
Renderiza um cartão animado de 2 segundos (48 quadros a 24 fps, 720 × 1280) e o inspeciona com `ffprobe`:
```bash
npm run render:diagnostic
```
Arquivo gerado:
`storage/diagnostics/diagnostic_card.mp4`

#### 6. Renderização do Piloto do Saruê com Voz e Legendas (Sprint 3 / 4)
Sintetiza a narração em português brasileiro com voz neural local Piper, sincroniza a movimentação da boca frame a frame, gera as legendas SRT e renderiza o vídeo do piloto:
```bash
npm run demo:pilot
```
Arquivos gerados:
- `storage/diagnostics/pilot_demo.mp4` (vídeo vertical 720×1280 a 24 fps)
- `storage/diagnostics/pilot_demo.srt` (legendas sincronizadas em formato SRT)
- `storage/diagnostics/pilot_synthesized_voice.wav` (áudio master sintetizado)

#### 7. Renderização do Episódio Completo do Saruê (Sprint 5)
Renderiza as 8 cenas completas do roteiro oficial ("Quando foi que descansar virou atraso?"), com planejamento automático do diretor, síntese neural de todas as falas, montagem da trilha mestre e muxing final em 720×1280:
```bash
npm run demo:episode
```
Arquivos gerados:
- `storage/diagnostics/episode_demo.mp4` (vídeo vertical 720×1280 a 24 fps, H.264 + AAC)
- `storage/diagnostics/episode_demo.srt` (arquivo de legendas sincronizado)
- `storage/diagnostics/episode_master_voice.wav` (áudio contínuo master)

### 8. Inicialização do Ambiente de Desenvolvimento e Estúdio Web
Inicia concorrentemente a API backend Express em loopback (`http://127.0.0.1:3000`) e a interface React do estúdio com Vite (`http://localhost:5173`):
```bash
npm run dev
```

### 9. Testes e Checagem de Tipos
```bash
npm test          # Executa a suíte de testes com Vitest (39 testes unitários)
npm run typecheck # Validação estrita do compilador TypeScript
```

---

## 📋 Resultados da Entrega do Sprint 1 (Fundação & Diagnóstico)
- [x] Repositório Git, lockfile e `.nvmrc` configurados.
- [x] API Express em loopback com `GET /api/health` e `GET /api/doctor`.
- [x] Vínculo e resolução segura de chaves do `config.toml` legado sem vazamento de dados.
- [x] Cartão de diagnóstico de 2 segundos renderizado e inspecionado via ffprobe (`storage/diagnostics/diagnostic_card.mp4`).

---

## 🎭 Resultados da Entrega do Sprint 2 (Rig e Piloto Manual do Saruê)
- [x] Rig Procedural SVG do Saruê (`src/video/characters/SarueRig.tsx`) com articulação suave.
- [x] Catálogo de Ações e Objetos de Cena (`idle`, `blink`, `raise_brow`, `pick_up_phone`, `show_prop`, `timer`, etc.).
- [x] Enquadramentos de Câmera (`medium` e `close`).
- [x] Piloto renderizado em 720 × 1280 a 24 fps sem consumo excessivo de memória.

---

## 🎙️ Resultados da Entrega do Sprint 3 (Voz, Boca e Legendas)

Todos os critérios de aceitação do Sprint 3 foram atendidos:

1. **Síntese de Voz Neural PT-BR com Piper:**
   - Modelo neural local `pt_BR-faber-medium.onnx` integrado via `uvx --from piper-tts piper` em [`src/server/voice.ts`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/server/voice.ts).
   - Execução 100% offline em CPU no hardware Dell sem engasgos ou necessidade de GPU.
   - Cache de áudio automático indexado por hash SHA-256 do texto para evitar re-síntese de sentenças inalteradas.

2. **Dicionário Fonético e Preservação de Texto Canônico:**
   - Regras de substituição fonética configuráveis (`applyPronunciation`) que enviam fonemas amigáveis ao sintetizador mas mantêm a ortografia correta e canônica nas legendas e tela.

3. **Sincronização Labial (Lip-Sync Procedural):**
   - Mapeamento determinístico de abertura e fechamento da boca nos quadros de fala ativa (`src/server/timeline.ts`).
   - Fechamento estrito durante as pausas entre sentenças e cortes.

4. **Legendas SRT e Timeline Integrada:**
   - Geração automática de arquivo `.srt` padrão com timestamps no formato `HH:MM:SS,mmm` (`generateSrt`).
   - A timeline de vídeo é automaticamente redimensionada para a duração exata da voz sintetizada.
   - Demonstração do piloto gerada com áudio de 10.13 segundos (243 quadros a 24 fps) e mux de áudio AAC estéreo.

---

## 🎬 Resultados da Entrega do Sprint 4 (Direção Automática & Trabalho Retomável)

Todos os critérios de aceitação do Sprint 4 foram atendidos:

1. **Catálogo de Rig e Cenários Expandido:**
   - **Novas Ações:** `tired` (expressão de cansaço), `store_phone` (guardar o celular), `relax` (relaxar ombros e respirar) e `look_desk` (olhar para a mesa).
   - **Novo Prop:** `notebook` (caderno aberto com três marcas simples desenhadas procedurais).
   - **Novos Cenários (Sets):** `living_room_sofa` (sala aconchegante com sofá estofado) e `sports_court` (detalhe de quadra com demarcações estilizadas).
   - Cadastrados em [`assets/characters/sarue/rig.json`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/assets/characters/sarue/rig.json) e renderizados em [`src/video/characters/SarueRig.tsx`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/video/characters/SarueRig.tsx) e [`src/video/Scene.tsx`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/video/Scene.tsx).

2. **Diretor Automático Declarativo ([`src/server/director.ts`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/server/director.ts)):**
   - Função `planScenes(script, rig, options)` mapeia texto cru diretamente em planos e cortes (shots) validados contra o catálogo do Rig.
   - Preservação estrita da literalidade do texto aprovado (`startChar` e `endChar`), respeitando acentos e emojis.
   - Conexão nativa com a API Gemini usando credenciais seguras do `config.toml` legado sem vazamento.
   - Distinção inequívoca entre credencial ausente (`CONFIG_MISSING`) e autenticação rejeitada (`AUTH_FAILED`).
   - Até 1 tentativa de reparo automático caso a resposta não atenda ao schema Zod.
   - Storyboard local determinístico inteligente integrado para execução rápida sem consumo de cota ou sem internet (`provider: 'mock'`).

3. **Esteira de Jobs e Projetos Retomáveis ([`src/server/jobs.ts`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/server/jobs.ts)):**
   - Persistência estruturada em `storage/projects/<projectId>/` com `meta.json`, `script.txt`, `plan.json`, `timeline.json` e `subtitles.srt`.
   - **Retomada de Interrupções:** Se interrompido após o planejamento, retoma diretamente na síntese de voz sem refazer o plano.
   - **Cache de Voz Preservado:** Alterações manuais ou ajustes visuais de gestos reaproveitam o áudio já sintetizado sem re-síntese de voz.

4. **Piloto em Modo Automático:**
   - `scripts/demo-pilot.ts` planeja e sintetiza automaticamente as cenas sem necessidade de plano manual.

---

## 🏆 Resultados da Entrega do Sprint 5 (Estúdio e Short Completo)

Todos os critérios de aceitação do Sprint 5 foram atendidos:

1. **API REST Completa de Projetos e Estúdio (`src/server/index.ts`):**
   - `GET /api/projects`: listagem estruturada de todos os projetos em `storage/projects/`.
   - `POST /api/projects`: criação atômica de novo projeto a partir de título e roteiro aprovado.
   - `GET /api/projects/:id`: recuperação completa do estado, metadados, plano, timelines e legendas.
   - `POST /api/projects/:id/generate`: disparo da esteira de geração (planejamento, síntese de voz e timeline).
   - `PUT /api/projects/:id/plan`: ajuste localizado de direção e ações por cena com reaproveitamento de áudio.
   - `POST /api/projects/:id/approve`: aprovação formal da revisão exibida.
   - `POST /api/projects/:id/render`: renderização do vídeo final vertical 9:16 com Remotion.

2. **Remotion Composition Sequencial de Episódio ([`src/video/EpisodeDemo.tsx`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/video/EpisodeDemo.tsx)):**
   - Composição `EpisodeDemo` registrada em [`src/video/Root.tsx`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/video/Root.tsx).
   - Encadeamento contínuo das 8 cenas utilizando `<Sequence>` do Remotion com cálculo dinâmico de duração total via `calculateMetadata`.
   - Preservação rigorosa das margens editoriais (40 px laterais, 167 px topo, 233 px base) e legendas sincronizadas.

3. **Demonstração do Episódio Oficial de 8 Cenas (`npm run demo:episode`):**
   - Execução do roteiro oficial *"Quando foi que descansar virou atraso?"* ([`tests/fixtures/episode.txt`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/tests/fixtures/episode.txt)).
   - Planejamento automático pelo diretor com variação expressiva de gestos (`tired`, `look_desk`, `pick_up_phone`, `show_prop`, `point`, `store_phone`, `relax`).
   - Síntese neural de voz em português brasileiro para as 8 cenas via Piper.
   - Exportação completa em `storage/diagnostics/episode_demo.mp4` e `storage/diagnostics/episode_demo.srt`.

4. **Interface Web do Estúdio de Criação ([`src/web/App.tsx`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/web/App.tsx)):**
   - Editor de roteiro com contagem de cenas por parágrafo.
   - Painel de revisão por cena com edição de ações visuais.
   - Player vertical 9:16 com alternância entre episódio completo, piloto e diagnóstico.
   - Botões de aprovação de revisão e download direto de MP4 e SRT.
   - Modal interativo do `doctor` com verificação de ferramentas locais.

5. **Métricas de Produção Local no Dell Inspiron 5458 (Linux Mint, 8 GB RAM, HD Mecânico):**
   - Tempo de Render do Episódio Completo: **101.4 segundos**
   - Resolução: **720 × 1280 a 24 fps** (Vertical 9:16)
   - Codec: **H.264 (High) + AAC Estéreo**
   - Tamanho do Arquivo: **0.96 MB**
   - Concorrência de Render: **1** (respeitando o limite de RAM de 8 GB)
   - Suíte de Testes: **39 testes unitários em 9 arquivos com 100% de aprovação no Vitest**.
