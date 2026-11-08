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

### 6. Inicialização do Ambiente de Desenvolvimento
Inicia concorrentemente a API backend Express em loopback (`http://127.0.0.1:3000`) e a interface React com Vite (`http://localhost:5173`):
```bash
npm run dev
```

### 7. Testes e Checagem de Tipos
```bash
npm test          # Executa a suíte de testes com Vitest
npm run typecheck # Validação estrita do compilador TypeScript
```

---

## 📋 Resultados da Entrega do Sprint 1

Todos os critérios de aceitação do Sprint 1 foram comprovados:

1. **Repositório Git e npm:**
   - Pacote `fabrica-de-bermudas-2` criado com lockfile `package-lock.json`.
   - `.nvmrc` registrado com `22.23.2`.
   - `.gitignore` protegendo `node_modules`, `dist`, `storage/` e `.env`.
   - `.env.example` documentando os adaptadores suportados.

2. **Serviço Express e API de Diagnóstico:**
   - `GET /api/health` respondendo com status `ok`, versão e uptime.
   - `GET /api/doctor` retornando o diagnóstico estruturado das ferramentas e configuração.
   - Vite configurado com proxy para `/api` e `/media`.

3. **Diagnóstico e Vínculo de Configuração Legada:**
   - `npm run config:link` e detecção automática restrita a pastas irmãs.
   - Resolução segura de chaves em memória no servidor: nenhum valor é exposto no Git, nos logs, no frontend ou no diagnóstico.
   - 8 testes cobrindo isolamento, precedência de variáveis de ambiente, caminhos com espaços e acentos, e tolerância a falhas.

4. **Renderização de Diagnóstico e ffprobe:**
   - Renderização Remotion funcional em caminho com espaços e acentos:  
     `/home/lucasregis/Área de trabalho/Projetos/Backup/Fabrica de bermudas 2.0/storage/diagnostics/diagnostic_card.mp4`
   - Metadados verificados via ffprobe:
     - Resolução: `720 × 1280` (Vertical 9:16)
     - Codec de Vídeo: `h264` (H.264)
     - Taxa de Quadros: `24 fps`
     - Duração: `2.00 segundos` (48 quadros)
     - Tamanho: `~164 KB`
     - Sem dependência de GPU.

5. **Interface de Usuário:**
   - Tela com entrada de roteiro, seleção de personagem (Saruê), lista de cenas para revisão e player de prévia vertical integrado.

6. **Bloqueios Identificados:**
   - Nenhum bloqueio. Todas as ferramentas e dependências estão validadas e prontas para o **Sprint 2 (Rig e Piloto Manual do Saruê)**.
