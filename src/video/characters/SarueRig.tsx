import React from 'react';
import { interpolate, spring } from 'remotion';

export type SarueAction =
  | 'idle'
  | 'blink'
  | 'raise_brow'
  | 'pick_up_phone'
  | 'put_down_phone'
  | 'show_prop'
  | 'point'
  | 'tired'
  | 'store_phone'
  | 'relax'
  | 'look_desk';

export type SarueProp = 'none' | 'phone' | 'timer' | 'notebook';
export type CameraPreset = 'medium' | 'close' | 'wide';

export interface SarueRigProps {
  action?: SarueAction;
  actionStartFrame?: number;
  prop?: SarueProp;
  camera?: CameraPreset;
  mouthState?: 'closed' | 'open';
  frame: number;
  fps?: number;
  showDesk?: boolean;
}

export const SarueRig: React.FC<SarueRigProps> = ({
  action = 'idle',
  actionStartFrame = 0,
  prop = 'none',
  camera = 'medium',
  mouthState = 'closed',
  frame,
  fps = 24,
  showDesk = true,
}) => {
  const relativeFrame = Math.max(0, frame - actionStartFrame);

  // 1. Respiração e oscilações procedurais suaves de repouso (sem saltos)
  const breathRate = action === 'tired' ? 0.9 : 1.5;
  const breathAmp = action === 'tired' ? 4.5 : 3;
  const breath = Math.sin((frame / fps) * Math.PI * breathRate) * breathAmp;
  const tailSway = Math.sin((frame / fps) * Math.PI * 1.2) * 8;

  // 2. Sobrancelha (raise_brow ou tired)
  let browLift = 0;
  if (action === 'raise_brow') {
    browLift = spring({
      frame: relativeFrame,
      fps,
      config: { damping: 14, stiffness: 120 },
    }) * 16;
  } else if (action === 'tired') {
    browLift = -6; // Sobrancelha caída expressando cansaço
  }

  // 3. Piscar de olhos (blink) a cada ~3.5s ou quando a ação for 'blink'
  const periodicBlink = frame % 80 >= 74 && frame % 80 <= 78;
  const actionBlink = action === 'blink' && relativeFrame >= 0 && relativeFrame <= 8;
  const isBlinking = periodicBlink || actionBlink;

  // 4. Cinemática da cabeça e inclinação
  let headAngle = 0;
  if (action === 'look_desk') {
    const lookProgress = spring({
      frame: relativeFrame,
      fps,
      config: { damping: 15, stiffness: 80 },
    });
    headAngle = interpolate(lookProgress, [0, 1], [0, 10]); // Inclina a cabeça em direção à mesa
  } else if (action === 'tired') {
    headAngle = 5;
  }

  // 5. Cinemática do braço direito e mão ativa
  let rightArmRotation = 0; // graus em torno do ombro
  let rightHandY = 0;
  let activeProp = prop;

  if (action === 'pick_up_phone') {
    // Transição suave pegando o celular da mesa até a altura do peito
    const pickProgress = spring({
      frame: relativeFrame,
      fps,
      config: { damping: 15, stiffness: 90 },
    });
    rightArmRotation = interpolate(pickProgress, [0, 1], [0, -32]);
    rightHandY = interpolate(pickProgress, [0, 1], [0, -110]);
    activeProp = 'phone';
  } else if (action === 'put_down_phone' || action === 'store_phone') {
    const putProgress = spring({
      frame: relativeFrame,
      fps,
      config: { damping: 15, stiffness: 90 },
    });
    rightArmRotation = interpolate(putProgress, [0, 1], [-32, 0]);
    rightHandY = interpolate(putProgress, [0, 1], [-110, 0]);
    activeProp = putProgress < 0.7 ? 'phone' : 'none';
  } else if (action === 'show_prop') {
    // Apresenta o objeto (cronômetro ou celular) para frente
    const showProgress = spring({
      frame: relativeFrame,
      fps,
      config: { damping: 14, stiffness: 110 },
    });
    rightArmRotation = interpolate(showProgress, [0, 1], [0, -42]);
    rightHandY = interpolate(showProgress, [0, 1], [0, -135]);
  } else if (action === 'point') {
    const pointProgress = spring({
      frame: relativeFrame,
      fps,
      config: { damping: 14, stiffness: 100 },
    });
    rightArmRotation = interpolate(pointProgress, [0, 1], [0, -25]);
    rightHandY = interpolate(pointProgress, [0, 1], [0, -70]);
  } else if (action === 'relax') {
    rightArmRotation = 4;
  }

  // 6. Configuração da Câmera (Medium, Close, Wide)
  const isClose = camera === 'close';
  const isWide = camera === 'wide';
  const cameraScale = isClose ? 1.85 : (isWide ? 0.85 : 1.0);
  const cameraTranslateY = isClose ? 330 : (isWide ? -20 : 40);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <svg
        viewBox="0 0 800 1000"
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${cameraScale}) translateY(${cameraTranslateY}px)`,
          transformOrigin: '400px 420px',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <defs>
          {/* Gradientes da Corrente de Ouro */}
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          {/* Gradiente da Lente dos Óculos */}
          <linearGradient id="sunglassLens" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="70%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* Reflexo dos Óculos */}
          <linearGradient id="lensShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Gradiente do Pelagem do Saruê */}
          <linearGradient id="furDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Gradiente do Boné */}
          <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        {/* ========================================================
            CAMADA 10: CAUDA PREÊNSIL DO GAMBÁ (Atrás do corpo)
            ======================================================== */}
        <g transform={`rotate(${tailSway}, 440, 750)`}>
          {/* Base cinza escuro passando para cauda rosada */}
          <path
            d="M 440 730 C 530 740, 600 780, 580 840 C 560 900, 480 890, 470 850 C 460 810, 520 800, 510 780"
            fill="none"
            stroke="#f472b6"
            strokeWidth="24"
            strokeLinecap="round"
          />
          <path
            d="M 440 730 C 480 735, 520 750, 525 770"
            fill="none"
            stroke="#334155"
            strokeWidth="26"
            strokeLinecap="round"
          />
        </g>

        {/* ========================================================
            CAMADA 20: TRONCO E ROUPA DO SARUÊ
            ======================================================== */}
        <g transform={`translate(0, ${breath})`}>
          {/* Peito e Ombros */}
          <path
            d="M 280 520 C 260 580, 250 720, 260 760 L 540 760 C 550 720, 540 580, 520 520 C 480 500, 320 500, 280 520 Z"
            fill="url(#furDark)"
          />

          {/* Peito de Pelagem Clara do Gambá */}
          <path
            d="M 350 515 C 330 580, 340 700, 360 740 L 440 740 C 460 700, 470 580, 450 515 Z"
            fill="#e2e8f0"
          />

          {/* Detalhes de Jaqueta / Camisa Streetwear */}
          <path
            d="M 280 520 C 310 560, 330 650, 335 760 L 260 760 Z"
            fill="#0f172a"
          />
          <path
            d="M 520 520 C 490 560, 470 650, 465 760 L 540 760 Z"
            fill="#0f172a"
          />

          {/* ========================================================
              CAMADA 25: CORRENTE DE OURO (Gold Chain com medalha)
              ======================================================== */}
          <path
            d="M 330 505 C 360 575, 440 575, 470 505"
            fill="none"
            stroke="url(#goldGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="4 2"
          />
          {/* Medalha / Pingente de Ouro */}
          <circle cx="400" cy="565" r="14" fill="url(#goldGrad)" stroke="#b45309" strokeWidth="2" />
          <text x="400" y="571" fontSize="13" fontWeight="900" fill="#78350f" textAnchor="middle">
            $
          </text>
        </g>

        {/* ========================================================
            CAMADA 28: BRAÇO ESQUERDO (Apoiado na mesa / repouso)
            ======================================================== */}
        <g>
          <path
            d="M 280 530 C 230 580, 220 670, 260 730"
            fill="none"
            stroke="#1e293b"
            strokeWidth="38"
            strokeLinecap="round"
          />
          {/* Pata esquerda com dedinhos rosados */}
          <circle cx="265" cy="735" r="18" fill="#f472b6" />
          <circle cx="255" cy="728" r="6" fill="#f472b6" />
          <circle cx="275" cy="728" r="6" fill="#f472b6" />
        </g>

        {/* ========================================================
            CAMADA 30: CABEÇA, ORELHAS E FOCINHO
            ======================================================== */}
        <g transform={`translate(0, ${breath * 0.5}) rotate(${headAngle}, 400, 360)`}>
          {/* Orelha Esquerda */}
          <ellipse cx="290" cy="300" rx="42" ry="46" fill="#1e293b" />
          <ellipse cx="292" cy="300" rx="28" ry="32" fill="#f472b6" />

          {/* Orelha Direita */}
          <ellipse cx="510" cy="300" rx="42" ry="46" fill="#1e293b" />
          <ellipse cx="508" cy="300" rx="28" ry="32" fill="#f472b6" />

          {/* Formato Base da Cabeça Triangular do Gambá */}
          <polygon
            points="310,300 490,300 450,470 350,470"
            fill="url(#furDark)"
          />
          <circle cx="400" cy="360" r="105" fill="url(#furDark)" />

          {/* Máscara Facial Branca Típica do Gambá Saruê */}
          <path
            d="M 330 350 C 320 430, 360 480, 400 485 C 440 480, 480 430, 470 350 C 440 370, 360 370, 330 350 Z"
            fill="#f8fafc"
          />
          {/* Listra escura central na testa do Saruê */}
          <path d="M 395 300 L 405 300 L 402 430 L 398 430 Z" fill="#1e293b" />

          {/* ========================================================
              CAMADA 34: BOCA (Aberta ou Fechada)
              ======================================================== */}
          {mouthState === 'open' ? (
            <g transform="translate(400, 462)">
              <ellipse cx="0" cy="0" rx="16" ry="10" fill="#881337" />
              {/* Língua */}
              <ellipse cx="0" cy="4" rx="10" ry="5" fill="#f472b6" />
              {/* Dentinhos superiores característicos */}
              <polygon points="-6,-9 -3,-4 0,-9 3,-4 6,-9" fill="#ffffff" />
            </g>
          ) : (
            <path
              d="M 388 460 Q 400 467 412 460"
              fill="none"
              stroke="#0f172a"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* Focinho pontudo rosado */}
          <path
            d="M 388 440 C 388 432, 412 432, 412 440 C 412 448, 400 453, 400 453 C 400 453, 388 448, 388 440 Z"
            fill="#f472b6"
          />
          {/* Narinas */}
          <circle cx="395" cy="442" r="2" fill="#9d174d" />
          <circle cx="405" cy="442" r="2" fill="#9d174d" />

          {/* Bigodes estéticos */}
          <line x1="330" y1="440" x2="380" y2="445" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <line x1="325" y1="455" x2="380" y2="452" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <line x1="470" y1="440" x2="420" y2="445" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <line x1="475" y1="455" x2="420" y2="452" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />

          {/* ========================================================
              CAMADA 38: ÓCULOS ESCUROS DE ACETATO
              ======================================================== */}
          <g transform="translate(0, -6)">
            {/* Haste Central */}
            <rect x="385" y="358" width="30" height="7" rx="3" fill="#020617" />

            {/* Lente Esquerda */}
            <rect x="315" y="342" width="76" height="48" rx="14" fill="url(#sunglassLens)" stroke="#0f172a" strokeWidth="5" />
            <path d="M 320 348 L 380 348 L 360 384 L 320 384 Z" fill="url(#lensShine)" />

            {/* Lente Direita */}
            <rect x="409" y="342" width="76" height="48" rx="14" fill="url(#sunglassLens)" stroke="#0f172a" strokeWidth="5" />
            <path d="M 414 348 L 474 348 L 454 384 L 414 384 Z" fill="url(#lensShine)" />

            {/* Efeito de piscar sobre as lentes (se ativo) */}
            {isBlinking && (
              <g>
                <line x1="320" y1="366" x2="385" y2="366" stroke="#38bdf8" strokeWidth="4" />
                <line x1="415" y1="366" x2="480" y2="366" stroke="#38bdf8" strokeWidth="4" />
              </g>
            )}
          </g>

          {/* ========================================================
              CAMADA 40: SOBRANCELHAS EXPRESSIVAS (Tufts de pelo)
              ======================================================== */}
          <g>
            {/* Sobrancelha Esquerda */}
            <path
              d="M 330 326 Q 355 316 385 324"
              fill="none"
              stroke="#f8fafc"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Sobrancelha Direita (levanta em raise_brow) */}
            <path
              d={`M 415 ${324 - browLift * 0.4} Q 445 ${316 - browLift} 470 ${326 - browLift * 0.8}`}
              fill="none"
              stroke="#f8fafc"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>

          {/* ========================================================
              CAMADA 45: BONÉ STREETWEAR (Virado para trás)
              ======================================================== */}
          <g transform="translate(0, -10)">
            {/* Copa do Boné */}
            <path
              d="M 315 285 C 315 210, 485 210, 485 285 Z"
              fill="url(#capGrad)"
            />
            {/* Aba do Boné Virada */}
            <path
              d="M 300 285 C 300 270, 500 270, 500 285 C 500 300, 300 300, 300 285 Z"
              fill="#0369a1"
            />
            {/* Fecho Snapback traseiro com furinhos visíveis */}
            <rect x="382" y="278" width="36" height="8" rx="4" fill="#0f172a" />
            <circle cx="390" cy="282" r="1.5" fill="#e2e8f0" />
            <circle cx="396" cy="282" r="1.5" fill="#e2e8f0" />
            <circle cx="402" cy="282" r="1.5" fill="#e2e8f0" />
            <circle cx="408" cy="282" r="1.5" fill="#e2e8f0" />

            {/* Botão Superior */}
            <circle cx="400" cy="220" r="7" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
          </g>
        </g>

        {/* ========================================================
            CAMADA 50: BRAÇO DIREITO E MÃO ATIVA (Com interpolação)
            ======================================================== */}
        <g
          transform={`rotate(${rightArmRotation}, 510, 520) translate(0, ${rightHandY})`}
        >
          {/* Braço Direito */}
          <path
            d="M 510 520 C 560 570, 570 650, 540 710"
            fill="none"
            stroke="#1e293b"
            strokeWidth="38"
            strokeLinecap="round"
          />

          {/* Pata Direita */}
          <circle cx="538" cy="710" r="19" fill="#f472b6" />
          <circle cx="528" cy="703" r="6" fill="#f472b6" />
          <circle cx="548" cy="703" r="6" fill="#f472b6" />

          {/* Gesto de Apontar (point) */}
          {action === 'point' && (
            <line x1="538" y1="710" x2="590" y2="690" stroke="#f472b6" strokeWidth="10" strokeLinecap="round" />
          )}

          {/* Objeto Ativo na Mão (Celular ou Cronômetro) */}
          {activeProp === 'phone' && (
            <g transform="translate(520, 650) rotate(-10)">
              {/* Corpo do Celular */}
              <rect x="0" y="0" width="55" height="100" rx="10" fill="#0f172a" stroke="#475569" strokeWidth="3" />
              {/* Tela Iluminada */}
              <rect x="5" y="8" width="45" height="84" rx="6" fill="#1e293b" />
              {/* Ícones coloridos na tela simulando apps */}
              <rect x="10" y="15" width="10" height="10" rx="3" fill="#38bdf8" />
              <rect x="25" y="15" width="10" height="10" rx="3" fill="#10b981" />
              <rect x="10" y="32" width="10" height="10" rx="3" fill="#f59e0b" />
              <rect x="25" y="32" width="10" height="10" rx="3" fill="#ec4899" />
              {/* Barra de Notificação */}
              <rect x="10" y="55" width="35" height="16" rx="4" fill="#334155" />
            </g>
          )}

          {activeProp === 'timer' && (
            <g transform="translate(510, 640) scale(1.1)">
              {/* Corpo do Cronômetro */}
              <circle cx="30" cy="40" r="38" fill="#1e293b" stroke="#38bdf8" strokeWidth="4" />
              <rect x="25" y="-5" width="10" height="10" fill="#64748b" />
              <circle cx="30" cy="40" r="30" fill="#0f172a" />
              {/* Dígitos do Cronômetro Digital "10:00" */}
              <text
                x="30"
                y="46"
                fontSize="15"
                fontWeight="900"
                fill="#34d399"
                textAnchor="middle"
                fontFamily="monospace"
              >
                10:00
              </text>
              <text
                x="30"
                y="60"
                fontSize="8"
                fontWeight="700"
                fill="#94a3b8"
                textAnchor="middle"
              >
                TIMER
              </text>
            </g>
          )}
        </g>

        {/* ========================================================
            CAMADA 60: MESA DE SUPORTE (Desk)
            ======================================================== */}
        {showDesk && !isClose && (
          <g id="desk-layer">
            {/* Superfície da Mesa de Madeira/Estúdio */}
            <path
              d="M 100 750 L 700 750 L 760 980 L 40 980 Z"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="4"
            />
            {/* Borda Iluminada da Mesa */}
            <line x1="100" y1="750" x2="700" y2="750" stroke="#475569" strokeWidth="6" />

            {/* Se o celular estiver descansando na mesa (idle) */}
            {activeProp === 'none' && prop === 'phone' && (
              <g transform="translate(480, 765) rotate(15)">
                <rect x="0" y="0" width="45" height="80" rx="8" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                <rect x="4" y="6" width="37" height="68" rx="4" fill="#1e293b" />
              </g>
            )}

            {/* Caderno aberto na mesa (notebook) */}
            {prop === 'notebook' && (
              <g transform="translate(350, 760) rotate(-3)">
                {/* Capa e borda do caderno */}
                <rect x="0" y="0" width="100" height="70" rx="4" fill="#334155" stroke="#1e293b" strokeWidth="2" />
                {/* Páginas abertas */}
                <rect x="3" y="3" width="46" height="64" rx="2" fill="#f8fafc" />
                <rect x="51" y="3" width="46" height="64" rx="2" fill="#f1f5f9" />
                {/* Espiral central */}
                <line x1="49" y1="3" x2="49" y2="67" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 2" />
                {/* Três marcas simples na página da esquerda */}
                <line x1="12" y1="20" x2="40" y2="20" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
                <line x1="12" y1="34" x2="40" y2="34" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
                <line x1="12" y1="48" x2="35" y2="48" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
                {/* Marcas na página da direita */}
                <line x1="58" y1="20" x2="86" y2="20" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                <line x1="58" y1="34" x2="80" y2="34" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
