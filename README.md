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

### 6. Renderização do Piloto do Saruê (16s - Sprint 2)
Renderiza as duas cenas de teste do piloto com atuação do Saruê, corte interno de câmera (plano médio para close), celular e cronômetro:
```bash
npm run demo:pilot
```
Arquivo gerado:
`storage/diagnostics/pilot_demo.mp4`

### 7. Inicialização do Ambiente de Desenvolvimento
Inicia concorrentemente a API backend Express em loopback (`http://127.0.0.1:3000`) e a interface React com Vite (`http://localhost:5173`):
```bash
npm run dev
```

### 8. Testes e Checagem de Tipos
```bash
npm test          # Executa a suíte de testes com Vitest (16 testes)
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

Todos os critérios de aceitação do Sprint 2 foram atendidos:

1. **Rig Procedural SVG do Saruê:**
   - Criado em [`src/video/characters/SarueRig.tsx`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/video/characters/SarueRig.tsx) e especificado em [`assets/characters/sarue/rig.json`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/assets/characters/sarue/rig.json).
   - Camadas independentes: cauda preênsil animada, tronco, braço esquerdo, cabeça com máscara facial branca e focinho rosado, boca animável, olhos com reflexos, óculos escuros de acetato, sobrancelhas de tufo branco, boné streetwear virado com snapback, e corrente de ouro com medalha.
   - Poses de repouso com amortecimento suave (`spring` / `sine`) para evitar saltos ou descontinuidades visuais entre ações.

2. **Catálogo de Ações e Objetos de Cena:**
   - Movimentos registrados e testados: `idle`, `blink`, `raise_brow`, `pick_up_phone`, `put_down_phone`, `show_prop` e `point`.
   - Objetos estilizados (props):
     - `phone`: smartphone com tela iluminada e ícones de aplicativos.
     - `timer`: cronômetro digital exibindo contagem regressiva "10:00" em verde fosforescente.
     - `desk`: mesa de estúdio urbano com iluminação de borda.

3. **Câmeras e Enquadramentos:**
   - `medium`: plano médio mostrando a mesa, tronco, braços e cauda.
   - `close`: close-up ampliado no rosto do Saruê para realçar reações e micro-expressões faciais (elevação da sobrancelha).

4. **Piloto Animado de 16 Segundos (`npm run demo:pilot`):**
   - Composição sequencial em [`src/video/PilotDemo.tsx`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/src/video/PilotDemo.tsx) com as Cenas 2 e 3 do roteiro piloto ([`tests/fixtures/pilot.txt`](file:///home/lucasregis/%C3%81rea%20de%20trabalho/Projetos/Backup/Fabrica%20de%20bermudas%202.0/tests/fixtures/pilot.txt)):
     - **Cena 1 (8.5s / 204 quadros):** Troca interna de plano. Saruê em plano médio pega o celular (`pick_up_phone`), corta para close com o celular iluminando o rosto enquanto lê mensagens.
     - **Cena 2 (7.5s / 180 quadros):** Exibe o cronômetro (`show_prop` com `timer`) e corta para close erguendo a sobrancelha (`raise_brow`) ao perceber a contradição da cobrança.
   - Áudio de teste acoplado (`storage/diagnostics/pilot_test_audio.aac`).
   - Métricas no Dell Inspiron 5458 (Linux Mint, 8 GB RAM, HD):
     - Tempo de render: **88.3 segundos**
     - Consumo de heap delta: apenas **20.3 MB**
     - Saída: `720 × 1280` a `24 fps`, codec `H.264`, áudio `AAC`, tamanho de **1.15 MB**.
   - Quadros-chave extraídos e validados em `storage/diagnostics/frames/`.

5. **Próximo Passo:**
   - **Sprint 3:** Síntese de voz PT-BR real (Piper/TTS), sincronização labial fonética por energia de áudio, geração de SRT e integração de timeline.
