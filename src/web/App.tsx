import React, { useEffect, useState } from 'react';
import type { HealthStatus, DoctorReport } from '../shared/contracts';

interface SceneItem {
  id: number;
  text: string;
  shot: 'medium' | 'close' | 'wide';
  action: string;
}

const DEFAULT_SCRIPT = `Eu sentei no sofá pra descansar. Em menos de um minuto, já tava me perguntando se eu não devia estar fazendo outra coisa.

Peguei o celular pra olhar a hora. Quando vi, eu tava respondendo mensagem que podia esperar até amanhã.

Aí coloquei um cronômetro de dez minutos. Até pra parar eu inventei um jeito de me fiscalizar.

E a cabeça já tava na terça-feira, no treino que faltava e na mensagem que eu ainda precisava mandar.

O engraçado é que ninguém tinha me cobrado nada naquele momento. Eu já tinha sentado no sofá com a cobrança junto.

Outro dia eu fui ver um jogo com um amigo. A gente ficou dez minutos sem falar de trabalho. Nem percebi.

Quando cheguei em casa, deixei o celular longe do sofá. Fiquei ali um tempo, ouvindo o barulho da rua.

Hoje eu ainda pego o celular sem pensar. Às vezes eu percebo, largo de novo e fico mais um pouco.`;

const DEFAULT_SCENES: SceneItem[] = [
  { id: 1, text: 'Eu sentei no sofá pra descansar. Em menos de um minuto, já tava me perguntando se eu não devia estar fazendo outra coisa.', shot: 'medium', action: 'Saruê relaxa. Na segunda frase, inclina a cabeça e olha para a mesa.' },
  { id: 2, text: 'Peguei o celular pra olhar a hora. Quando vi, eu tava respondendo mensagem que podia esperar até amanhã.', shot: 'close', action: 'Mão pega o celular. Corte para a tela com ícones, sem inventar mensagens.' },
  { id: 3, text: 'Aí coloquei um cronômetro de dez minutos. Até pra parar eu inventei um jeito de me fiscalizar.', shot: 'close', action: 'Cronômetro aparece na palavra "cronômetro". Close na sobrancelha.' },
  { id: 4, text: 'E a cabeça já tava na terça-feira, no treino que faltava e na mensagem que eu ainda precisava mandar.', shot: 'medium', action: 'Caderno abre na mesa com três marcas simples.' },
  { id: 5, text: 'O engraçado é que ninguém tinha me cobrado nada naquele momento. Eu já tinha sentado no sofá com a cobrança junto.', shot: 'medium', action: 'Volta ao plano médio. Saruê encara a câmera e deixa o celular.' },
  { id: 6, text: 'Outro dia eu fui ver um jogo com um amigo. A gente ficou dez minutos sem falar de trabalho. Nem percebi.', shot: 'wide', action: 'Quadro abre com detalhe de quadra. Saruê relaxa e sorri.' },
  { id: 7, text: 'Quando cheguei em casa, deixei o celular longe do sofá. Fiquei ali um tempo, ouvindo o barulho da rua.', shot: 'medium', action: 'Guarda o celular. Câmera segura o quadro por pausa curta.' },
  { id: 8, text: 'Hoje eu ainda pego o celular sem pensar. Às vezes eu percebo, largo de novo e fico mais um pouco.', shot: 'medium', action: 'A mão começa a ir até a mesa e recua. Corta após a fala.' },
];

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [script, setScript] = useState<string>(DEFAULT_SCRIPT);
  const [selectedCharacter] = useState<string>('sarue');
  const [scenes, setScenes] = useState<SceneItem[]>(DEFAULT_SCENES);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string>('/media/diagnostics/diagnostic_card.mp4');
  const [showDoctorModal, setShowDoctorModal] = useState<boolean>(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const [healthRes, docRes] = await Promise.all([
          fetch('/api/health'),
          fetch('/api/doctor'),
        ]);
        if (healthRes.ok) setHealth(await healthRes.json());
        if (docRes.ok) setDoctor(await docRes.json());
      } catch (err) {
        console.error('Falha ao conectar na API local:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  const handleActionChange = (id: number, newAction: string) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, action: newAction } : s))
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0f172a',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🎬</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Fábrica de Bermudas 2.0
            </h1>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Estúdio Editorial de Animação 2D Vertical • Sprint 1
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {health ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#1e293b',
                padding: '6px 12px',
                borderRadius: 9999,
                fontSize: 13,
                border: '1px solid #334155',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span>API Conectada (v{health.version})</span>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#451a1a',
                padding: '6px 12px',
                borderRadius: 9999,
                fontSize: 13,
                color: '#f87171',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span>{loading ? 'Conectando...' : 'API Desconectada'}</span>
            </div>
          )}

          <button
            onClick={() => setShowDoctorModal(!showDoctorModal)}
            style={{
              backgroundColor: doctor?.allRequiredOk ? '#0369a1' : '#b45309',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🩺 Diagnóstico ({doctor?.allRequiredOk ? 'Tudo OK' : 'Verificar'})
          </button>
        </div>
      </header>

      {/* Doctor Modal / Drawer */}
      {showDoctorModal && doctor && (
        <div
          style={{
            backgroundColor: '#1e293b',
            borderBottom: '2px solid #38bdf8',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#38bdf8' }}>
              Relatório Completo do Doctor (npm run doctor)
            </h2>
            <button
              onClick={() => setShowDoctorModal(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18 }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#f1f5f9' }}>Ferramentas do Sistema:</div>
              <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
                ✓ Node: {doctor.node.version} ({doctor.node.path})<br />
                ✓ FFmpeg: {doctor.ffmpeg.installed ? 'Instalado' : 'Ausente'}<br />
                ✓ ffprobe: {doctor.ffprobe.installed ? 'Instalado' : 'Ausente'}<br />
                ✓ Browser: {doctor.browser.installed ? doctor.browser.path : 'Ausente'}
              </div>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#f1f5f9' }}>Configuração Legada (config.toml):</div>
              <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
                Status: {doctor.legacyConfig.message}<br />
                Origem: <strong>{doctor.legacyConfig.source}</strong><br />
                Diretor: <strong>{doctor.legacyConfig.directorProvider ?? 'Nenhum'}</strong> ({doctor.legacyConfig.directorConfigured ? 'Configurado' : 'Pendente'})<br />
                Voz: <strong>{doctor.legacyConfig.ttsProvider ?? 'Nenhum'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 24,
          padding: 24,
          maxWidth: 1600,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Painel Esquerdo: Roteiro e Cenas */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card Roteiro */}
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 12,
              padding: 20,
              border: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>
                1. Roteiro em Português
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Personagem:</span>
                <span
                  style={{
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedCharacter === 'sarue' ? 'Saruê 2D' : selectedCharacter}
                </span>
              </div>
            </div>

            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'vertical',
              }}
              placeholder="Cole aqui seu roteiro..."
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {script.split(/\n\s*\n/).filter(Boolean).length} cenas detectadas por parágrafo
              </span>
              <button
                onClick={() => alert('Geração automática de plano de cenas programada para os Sprints 2-4.')}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Gerar Prévia de Cenas ➜
              </button>
            </div>
          </div>

          {/* Card Revisão de Cenas */}
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 12,
              padding: 20,
              border: '1px solid #334155',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                2. Lista de Cenas para Revisão ({scenes.length} Cenas)
              </h3>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Revisão e ajuste de atuação por cena
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 460, overflowY: 'auto' }}>
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#38bdf8' }}>
                      Cena {scene.id} • Plano: {scene.shot}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#e2e8f0', fontStyle: 'italic' }}>
                    "{scene.text}"
                  </p>
                  <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 2 }}>
                      Ação visual programada:
                    </label>
                    <input
                      type="text"
                      value={scene.action}
                      onChange={(e) => handleActionChange(scene.id, e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        color: '#f8fafc',
                        padding: '6px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Painel Direito: Prévia e Exportação */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card Prévia do Vídeo */}
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 12,
              padding: 20,
              border: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                3. Prévia de Vídeo (Vertical 9:16)
              </h3>
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                ● 24 FPS • Remotion
              </span>
            </div>

            {/* Container do Player 9:16 */}
            <div
              style={{
                width: 270,
                height: 480,
                backgroundColor: '#000000',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                border: '2px solid #334155',
                position: 'relative',
              }}
            >
              <video
                src={previewVideoUrl}
                controls
                loop
                autoPlay
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Cartão de Diagnóstico do Sprint 1 (2.00s / 48 quadros)
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Inspeção ffprobe: 720×1280 • H.264 • Sem GPU
              </div>
            </div>
          </div>

          {/* Card Exportação */}
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 12,
              padding: 20,
              border: '1px solid #334155',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700 }}>
              4. Exportação do Episódio (Sprint 5)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Resolução Final:</span>
                <div style={{ fontWeight: 600, color: '#f8fafc' }}>720 × 1280 (24 fps)</div>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Formato:</span>
                <div style={{ fontWeight: 600, color: '#f8fafc' }}>MP4 (H.264 / AAC) + SRT</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <a
                href="/media/diagnostics/diagnostic_card.mp4"
                download="diagnostic_card.mp4"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '10px 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ⬇ Baixar MP4 (Diagnóstico 2s)
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
