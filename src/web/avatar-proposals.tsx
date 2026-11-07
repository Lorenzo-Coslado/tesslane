import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RobotAvatar } from './RobotAvatar.tsx';
import { avatarPalette, defaultAvatar } from '../shared/avatars.ts';
import './avatar-proposals.css';

const states = [
  {
    id: 'idle',
    label: 'Au repos',
    description: 'Un regard calme, un sourire léger et quelques clignements.',
  },
  {
    id: 'working',
    label: 'En activité',
    description: 'Le regard se déplace doucement et la bouche s’anime. Aucun son.',
  },
  {
    id: 'waiting',
    label: 'En attente',
    description: 'La bouche se repose et le regard reste attentif.',
  },
  { id: 'completed', label: 'Terminé', description: 'Un sourire discret et un regard détendu.' },
] as const;
function Playground() {
  const [shell, setShell] = useState('#b7bdc8'),
    [state, setState] = useState<string>('idle'),
    [animate, setAnimate] = useState(true);
  const appearance = { ...defaultAvatar('preview'), shell },
    current = states.find((item) => item.id === state)!;
  return (
    <main className="proposal-page refinement-page">
      <header className="proposal-header">
        <a href="/" aria-label="Revenir au dashboard Tesslane">
          <img src="/tesslane.png" alt="Tesslane" />
        </a>
        <div>
          <h1>Le bot rond prend vie.</h1>
          <p>Une bouche, un regard animé et la couleur de toute la boule.</p>
        </div>
      </header>
      <section className="avatar-playground" aria-label="Prévisualisation du robot">
        <div className="playground-portrait">
          <RobotAvatar
            seed="round-preview"
            appearance={appearance}
            size={256}
            state={state}
            animate={animate}
            label="Robot rond animé"
          />
          <span>{current.label}</span>
        </div>
        <div className="playground-controls">
          <h2>Couleur de la boule</h2>
          <p>La coque se colore. Les yeux restent sombres et le relief argenté est conservé.</p>
          <div className="playground-swatches" role="group" aria-label="Couleur de la boule">
            {avatarPalette.map((color) => (
              <button
                key={color.name}
                aria-label={color.name}
                title={color.name}
                aria-pressed={shell === color.color}
                style={{ background: color.color }}
                onClick={() => setShell(color.color)}
              />
            ))}
          </div>
          <label className="playground-color">
            Couleur libre
            <input
              type="color"
              aria-label="Couleur libre de la boule"
              value={shell}
              onChange={(event) => setShell(event.target.value)}
            />
          </label>
          <h2>Expression & activité</h2>
          <div className="playground-states" role="group" aria-label="État de prévisualisation">
            {states.map((item) => (
              <button
                key={item.id}
                aria-pressed={state === item.id}
                onClick={() => setState(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="playground-description" role="status">
            {current.description}
          </p>
          <label className="playground-animation">
            <input
              type="checkbox"
              checked={animate}
              onChange={(event) => setAnimate(event.target.checked)}
            />
            Animations du visage
          </label>
          <small>Respecte « réduire les animations ». En pause hors écran.</small>
        </div>
      </section>
      <section className="playground-context">
        <div className="playground-context-heading">
          <h2>Dans le Swarm</h2>
          <span>Prévisualisation · états simulés</span>
        </div>
        <div className="playground-agents">
          {[
            { name: 'Coordinator', role: 'coordinator' as const },
            { name: 'Implementer', role: 'implementer' as const },
            { name: 'Reviewer', role: 'reviewer' as const },
          ].map((agent) => (
            <div className="playground-agent" key={agent.name}>
              <RobotAvatar
                seed={agent.name}
                role={agent.role}
                appearance={agent.role === 'implementer' ? appearance : undefined}
                state={state}
                animate={animate}
                size={44}
              />
              <div>
                <strong>{agent.name}</strong>
                <small>{current.label}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer>
        <p>La couleur identifie l’agent. Le visage accompagne son activité.</p>
        <a href="/">Ouvrir le dashboard</a>
      </footer>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Playground />);
