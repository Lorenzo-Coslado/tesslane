import { useRef, useState, type CSSProperties } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { RobotAvatar } from './RobotAvatar.tsx';
import {
  agentAvatar,
  avatarPalette,
  type AvatarPreferences,
  type RobotAppearance,
} from '../shared/avatars.ts';
import type { Agent } from '../shared/contracts.ts';
export function AvatarCustomizer({
  agent,
  preferences,
  save,
}: {
  agent: Agent;
  preferences: AvatarPreferences;
  save: (appearance: RobotAppearance | null) => Promise<unknown>;
}) {
  const current = agentAvatar(agent.id, agent.role, preferences),
    [open, setOpen] = useState(false),
    [draft, setDraft] = useState(current),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const persist = async (value: RobotAppearance | null) => {
    setBusy(true);
    setError('');
    try {
      await save(value);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (!svg.current) return;
    const copy = svg.current.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('width', '256');
    copy.setAttribute('height', '256');
    copy.removeAttribute('aria-hidden');
    copy.removeAttribute('class');
    copy.setAttribute('data-animate', 'false');
    const url = URL.createObjectURL(new Blob([copy.outerHTML], { type: 'image/svg+xml' })),
      link = document.createElement('a');
    link.href = url;
    link.download = 'tesslane-agent-' + agent.id.slice(0, 8) + '.svg';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="avatar-customizer">
      <button
        className="avatar-customize-toggle"
        aria-expanded={open}
        onClick={() => {
          setDraft(current);
          setError('');
          setOpen(!open);
        }}
      >
        Customize avatar
      </button>
      {open && (
        <div className="avatar-editor">
          <div className="avatar-preview">
            <RobotAvatar
              seed={agent.id}
              role={agent.role}
              appearance={draft}
              size={104}
              state={agent.state}
              svgRef={svg}
              label={'Avatar preview for ' + agent.name}
            />
            <p>
              Your agent’s appearance.
              <small>Saved locally. Execution and model settings stay the same.</small>
            </p>
          </div>
          <div className="avatar-swatches" role="group" aria-label="Shell color">
            {avatarPalette.map((color) => (
              <button
                key={color.name}
                title={color.name}
                aria-label={color.name + ' shell'}
                aria-pressed={draft.shell === color.color}
                style={{ '--swatch': color.color } as CSSProperties}
                onClick={() => setDraft({ ...draft, shell: color.color })}
              />
            ))}
          </div>
          <div className="avatar-color-fields">
            <label>
              Sphere
              <input
                type="color"
                aria-label="Custom shell color"
                value={draft.shell}
                onChange={(e) => setDraft({ ...draft, shell: e.target.value })}
              />
            </label>
            <label>
              Eyes
              <input
                type="color"
                aria-label="Eye color"
                value={draft.eyes}
                onChange={(e) => setDraft({ ...draft, eyes: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            Face
            <select
              value={draft.face}
              onChange={(e) =>
                setDraft({ ...draft, face: e.target.value as RobotAppearance['face'] })
              }
            >
              <option value="round">Round eyes</option>
              <option value="visor">Visor</option>
              <option value="pixels">Pixel eyes</option>
            </select>
          </label>
          <label className="field">
            Antenna · optional
            <select
              value={draft.antenna}
              onChange={(e) =>
                setDraft({ ...draft, antenna: e.target.value as RobotAppearance['antenna'] })
              }
            >
              <option value="single">Single</option>
              <option value="twin">Twin</option>
              <option value="none">None</option>
            </select>
          </label>
          <div className="avatar-editor-actions">
            <button className="primary" disabled={busy} onClick={() => void persist(draft)}>
              {busy ? 'Saving…' : 'Save avatar'}
            </button>
            <button disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          <div className="avatar-editor-actions">
            <button disabled={busy || !preferences[agent.id]} onClick={() => void persist(null)}>
              <RotateCcw size={12} />
              Reset avatar
            </button>
            <button disabled={busy} onClick={download}>
              <Download size={12} />
              Download SVG
            </button>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
