import React, { useEffect, useState } from 'react';
import type { HealthStatus, DoctorReport } from '../shared/contracts';

interface SceneItem {
  id: number;
  text: string;
  shot: 'medium' | 'close' | 'wide';
  action: string;
  setId?: string;
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
  { id: 1, text: 'Eu sentei no sofá pra descansar. Em menos de um minuto, já tava me perguntando se eu não devia estar fazendo outra coisa.', shot: 'medium', action: 'tired (Saruê relaxa e cansa no sofá)', setId: 'living_room_sofa' },
  { id: 2, text: 'Peguei o celular pra olhar a hora. Quando vi, eu tava respondendo mensagem que podia esperar até amanhã.', shot: 'close', action: 'pick_up_phone (Mão pega o celular)', setId: 'studio' },
  { id: 3, text: 'Aí coloquei um cronômetro de dez minutos. Até pra parar eu inventei um jeito de me fiscalizar.', shot: 'close', action: 'show_prop (timer) + raise_brow', setId: 'studio' },
  { id: 4, text: 'E a cabeça já tava na terça-feira, no treino que faltava e na mensagem que eu ainda precisava mandar.', shot: 'medium', action: 'point (notebook com três marcas)', setId: 'studio' },
  { id: 5, text: 'O engraçado é que ninguém tinha me cobrado nada naquele momento. Eu já tinha sentado no sofá com a cobrança junto.', shot: 'medium', action: 'store_phone (deixa o celular sobre a mesa)', setId: 'studio' },
  { id: 6, text: 'Outro dia eu fui ver um jogo com um amigo. A gente ficou dez minutos sem falar de trabalho. Nem percebi.', shot: 'wide', action: 'relax (quadra esportiva, relaxa os ombros)', setId: 'sports_court' },
  { id: 7, text: 'Quando cheguei em casa, deixei o celular longe do sofá. Fiquei ali um tempo, ouvindo o barulho da rua.', shot: 'medium', action: 'store_phone (guarda o celular)', setId: 'living_room_sofa' },
  { id: 8, text: 'Hoje eu ainda pego o celular sem pensar. Às vezes eu percebo, largo de novo e fico mais um pouco.', shot: 'medium', action: 'look_desk (mão vai à mesa e recua)', setId: 'studio' },
];

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [script, setScript] = useState<string>(DEFAULT_SCRIPT);
  const [selectedCharacter] = useState<string>('sarue');
  const [scenes, setScenes] = useState<SceneItem[]>(DEFAULT_SCENES);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string>('/media/diagnostics/episode_demo.mp4');
  const [showDoctorModal, setShowDoctorModal] = useState<boolean>(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Pronto para produção.');

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

  const handleGenerateProject = async () => {
    setIsGenerating(true);
    setStatusMessage('Criando projeto e disparando direção automática...');
    try {
      // 1. Criar projeto
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Episódio - ' + new Date().toLocaleTimeString(),
          scriptText: script,
          characterId: selectedCharacter,
        }),
      });

      if (!createRes.ok) throw new Error('Falha ao criar projeto na API');
      const projectMeta = await createRes.json();
      setCurrentProjectId(projectMeta.projectId);

      // 2. Disparar geração da esteira (planejamento + voz + timelines)
      setStatusMessage('Sintetizando voz PT-BR e compilando timelines...');
      const genRes = await fetch(`/api/projects/${projectMeta.projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planOptions: { provider: 'auto', fallbackToLocalStoryboard: true },
        }),
      });

      if (!genRes.ok) throw new Error('Falha ao executar esteira de geração');
      const genResult = await genRes.json();

      // 3. Atualizar lista de cenas com o plano do diretor
      if (genResult.plan && genResult.plan.scenes) {
        const updatedScenes: SceneItem[] = genResult.plan.scenes.map((s: any, idx: number) => {
          const firstShot = s.shots[0] || {};
          const actionsStr = (firstShot.actions || []).map((a: any) => `${a.actionId}${a.target ? ` (${a.target})` : ''}`).join(', ');
          return {
            id: idx + 1,
            text: script.slice(s.startChar, s.endChar),
            shot: firstShot.camera || 'medium',
            action: actionsStr || 'idle',
            setId: firstShot.setId || 'studio',
          };
        });
        setScenes(updatedScenes);
      }

      setStatusMessage(`Geração concluída! Duração calculada: ${genResult.durationSeconds?.toFixed(1) || '0'}s.`);
      setPreviewVideoUrl('/media/diagnostics/pilot_demo.mp4');
    } catch (err) {
      setStatusMessage(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!currentProjectId) {
      alert('Gere ou selecione um projeto antes de aprovar a revisão.');
      return;
    }
    try {
      setStatusMessage('Aprovando revisão para exportação final...');
      const res = await fetch(`/api/projects/${currentProjectId}/approve`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage('Revisão aprovada! Pronta para render final.');
        alert('Revisão aprovada com sucesso!');
      }
    } catch (err) {
      alert('Erro ao aprovar revisão: ' + String(err));
    }
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
              Estúdio Editorial de Animação 2D Vertical • Sprint 5 (Short Completo)
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
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#94a3b8' }}>Servidor Local 127.0.0.1:3001</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#f59e0b' }}>● Conectando servidor...</span>
          )}

          <button
            onClick={() => setShowDoctorModal(true)}
            style={{
              backgroundColor: doctor?.allRequiredOk ? '#065f46' : '#854d0e',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🩺</span>
            <span>Doctor: {doctor?.allRequiredOk ? 'Tudo OK' : 'Verificar'}</span>
          </button>
        </div>
      </header>

      {/* Barra de Status */}
      <div
        style={{
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '8px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#38bdf8' }}>Status do Estúdio:</span>
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>{statusMessage}</span>
        </div>
        {currentProjectId && (
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            Projeto Ativo: <code style={{ color: '#38bdf8' }}>{currentProjectId}</code>
          </span>
        )}
      </div>

      {/* Main Studio Layout */}
      <main style={{ flex: 1, padding: 24, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* Painel Esquerdo: Roteiro e Cenas */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card Entrada do Roteiro */}
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 12,
              padding: 20,
              border: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                1. Roteiro do Episódio (Texto Aprovado)
              </h2>
              <span style={{ fontSize: 12, color: '#38bdf8' }}>
                Personagem: <strong>Saruê</strong> (boné, óculos e corrente)
              </span>
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
                disabled={isGenerating}
                onClick={handleGenerateProject}
                style={{
                  backgroundColor: isGenerating ? '#64748b' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{isGenerating ? '⏳' : '🚀'}</span>
                <span>{isGenerating ? 'Gerando Plano e Voz...' : 'Gerar com Direção Automática'}</span>
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
                Revisão de atuação e enquadramento por cena
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
                      Cena {scene.id} • Plano: {scene.shot} {scene.setId ? `• Cenário: ${scene.setId}` : ''}
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

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setPreviewVideoUrl('/media/diagnostics/episode_demo.mp4')}
                style={{
                  backgroundColor: previewVideoUrl.includes('episode_demo') ? '#2563eb' : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🎬 Episódio Completo (60-90s)
              </button>
              <button
                onClick={() => setPreviewVideoUrl('/media/diagnostics/pilot_demo.mp4')}
                style={{
                  backgroundColor: previewVideoUrl.includes('pilot_demo') ? '#2563eb' : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🦝 Piloto do Saruê (10s)
              </button>
              <button
                onClick={() => setPreviewVideoUrl('/media/diagnostics/diagnostic_card.mp4')}
                style={{
                  backgroundColor: previewVideoUrl.includes('diagnostic_card') ? '#2563eb' : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🩺 Diagnóstico (2s)
              </button>
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
                key={previewVideoUrl}
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
                {previewVideoUrl.includes('episode_demo')
                  ? 'Episódio Completo do Saruê - Sprint 5 (720×1280 a 24 fps)'
                  : previewVideoUrl.includes('pilot_demo')
                  ? 'Piloto do Saruê - Sprint 3/4 (Voz Neural Piper e Boca Sincronizada)'
                  : 'Cartão de Diagnóstico - Sprint 1 (2.0s / 48 quadros a 24 fps)'}
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
                <span style={{ color: '#94a3b8' }}>Áudio & Codec:</span>
                <div style={{ fontWeight: 600, color: '#f8fafc' }}>H.264 + AAC Estéreo</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleApprove}
                style={{
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✓</span>
                <span>Aprovar Revisão & Marcar para Exportação</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <a
                  href={previewVideoUrl}
                  download="episodio_sarue.mp4"
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #0284c7',
                    padding: '10px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  📥 Baixar MP4
                </a>
                <a
                  href="/media/diagnostics/episode_demo.srt"
                  download="episodio_sarue.srt"
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#a78bfa',
                    border: '1px solid #7c3aed',
                    padding: '10px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  📄 Baixar Legendas (SRT)
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modal Doctor */}
      {showDoctorModal && doctor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 16,
              width: '90%',
              maxWidth: 600,
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Diagnóstico do Ambiente (Doctor)
              </h3>
              <button
                onClick={() => setShowDoctorModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc', marginBottom: 4 }}>
                  Configuração Legada (config.toml):
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Origem: <strong>{doctor.legacyConfig.source}</strong> • Diretor: {doctor.legacyConfig.directorProvider || 'local_mock'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  Status: {doctor.legacyConfig.message}
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc', marginBottom: 4 }}>
                  Ferramentas do Sistema:
                </div>
                <div style={{ fontSize: 12, color: doctor.node.installed ? '#10b981' : '#ef4444' }}>
                  ● Node.js: {doctor.node.version || 'Não encontrado'}
                </div>
                <div style={{ fontSize: 12, color: doctor.ffmpeg.installed ? '#10b981' : '#ef4444' }}>
                  ● FFmpeg: {doctor.ffmpeg.installed ? 'Instalado' : 'Não encontrado'}
                </div>
                <div style={{ fontSize: 12, color: doctor.ffprobe.installed ? '#10b981' : '#ef4444' }}>
                  ● ffprobe: {doctor.ffprobe.installed ? 'Instalado' : 'Não encontrado'}
                </div>
                <div style={{ fontSize: 12, color: doctor.browser.installed ? '#10b981' : '#ef4444' }}>
                  ● Navegador de Render: {doctor.browser.path || 'Não encontrado'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
