import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react';
import { defaultAvatar, type RobotAppearance } from '../shared/avatars.ts';
import type { Role } from '../shared/contracts.ts';

type Motion = 'idle' | 'working' | 'waiting' | 'done' | 'blocked';
function motionFor(state?: string): Motion {
  if (['working', 'starting', 'running', 'verifying', 'reviewing'].includes(state ?? ''))
    return 'working';
  if (['failed', 'blocked'].includes(state ?? '')) return 'blocked';
  if (['completed', 'integrated'].includes(state ?? '')) return 'done';
  if (
    [
      'waiting',
      'paused',
      'pausing',
      'awaiting_approval',
      'stopping',
      'interrupted',
      'recovering',
    ].includes(state ?? '')
  )
    return 'waiting';
  return 'idle';
}
const watched = new Map<Element, { intersecting: boolean; update: (visible: boolean) => void }>();
let observer: IntersectionObserver | undefined;
const visibility = () => {
  for (const item of watched.values()) item.update(item.intersecting && !document.hidden);
};
function watch(element: Element, update: (visible: boolean) => void) {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const item = watched.get(entry.target);
        if (item) {
          item.intersecting = entry.isIntersecting;
          item.update(entry.isIntersecting && !document.hidden);
        }
      }
    });
    document.addEventListener('visibilitychange', visibility);
  }
  watched.set(element, { intersecting: false, update });
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    watched.delete(element);
    if (!watched.size) {
      observer?.disconnect();
      observer = undefined;
      document.removeEventListener('visibilitychange', visibility);
    }
  };
}
function mix(hex: string, target: number, amount: number) {
  return (
    '#' +
    hex
      .slice(1)
      .match(/../g)!
      .map((x) =>
        Math.round(parseInt(x, 16) * (1 - amount) + target * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function RobotAvatar({
  seed,
  role = 'specialist',
  appearance,
  size = 36,
  label,
  svgRef,
  state,
  animate = true,
}: {
  seed: string;
  role?: Role;
  appearance?: RobotAppearance;
  size?: number;
  label?: string;
  svgRef?: Ref<SVGSVGElement>;
  state?: string;
  animate?: boolean;
}) {
  const style = appearance ?? defaultAvatar(seed, role),
    prefix = 'robot-' + useId().replace(/:/g, ''),
    ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  useImperativeHandle(svgRef, () => ref.current!, []);
  useEffect(() => {
    if (!animate || !ref.current) return;
    return watch(ref.current, setVisible);
  }, [animate]);
  const light = mix(style.shell, 255, 0.6),
    shade = mix(style.shell, 0, 0.35),
    phase = [...seed].reduce((n, c) => (n + c.charCodeAt(0)) % 43, 0) / 10;
  return (
    <svg
      ref={ref}
      id={prefix}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className="robot-avatar"
      data-motion={motionFor(state)}
      data-animate={animate && visible ? 'true' : 'false'}
      style={{ '--robot-phase': '-' + phase + 's' } as CSSProperties}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <style>{`
      #${prefix} .robot-eyes,#${prefix} .robot-mouth-open {transform-box:fill-box;transform-origin:center;}
      #${prefix} .robot-eyes {animation:${prefix}-blink 6.4s linear infinite;animation-delay:var(--robot-phase);}
      #${prefix} .robot-gaze {animation:none;}
      #${prefix} .robot-mouth-open,#${prefix} .robot-mouth-neutral {opacity:0;}
      #${prefix}[data-motion="working"] .robot-gaze {animation:${prefix}-gaze 3.8s ease-in-out infinite;animation-delay:var(--robot-phase);}
      #${prefix}[data-motion="working"] .robot-mouth-smile {opacity:0;}
      #${prefix}[data-motion="working"] .robot-mouth-open {opacity:1;animation:${prefix}-mouth 1.1s ease-in-out infinite;animation-delay:var(--robot-phase);}
      #${prefix}[data-motion="waiting"] .robot-mouth-smile,#${prefix}[data-motion="blocked"] .robot-mouth-smile {opacity:0;}
      #${prefix}[data-motion="waiting"] .robot-mouth-neutral,#${prefix}[data-motion="blocked"] .robot-mouth-neutral {opacity:1;}
      #${prefix}[data-motion="done"] .robot-eyes {animation:none;transform:scaleY(.72);}
      #${prefix}[data-animate="false"] .robot-eyes,#${prefix}[data-animate="false"] .robot-gaze,#${prefix}[data-animate="false"] .robot-mouth-open {animation-play-state:paused;}
      @keyframes ${prefix}-blink {0%,88%,93%,100%{transform:scaleY(1)}90%,91%{transform:scaleY(.12)}}
      @keyframes ${prefix}-gaze {0%,12%,100%{transform:translateX(0)}32%,43%{transform:translateX(1.4px)}68%,78%{transform:translateX(-1.1px)}}
      @keyframes ${prefix}-mouth {0%,100%{transform:scaleY(.5)}28%{transform:scaleY(1)}52%{transform:scaleY(.7)}73%{transform:scaleY(1.2)}}
      @media(prefers-reduced-motion:reduce){#${prefix} .robot-eyes,#${prefix} .robot-gaze,#${prefix} .robot-mouth-open{animation:none!important;}}
    `}</style>
      <defs>
        <radialGradient id={prefix + '-shell'} cx=".32" cy=".22" r=".84">
          <stop stopColor={light} />
          <stop offset=".34" stopColor={mix(style.shell, 255, 0.25)} />
          <stop offset=".72" stopColor={style.shell} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
        <radialGradient id={prefix + '-reflection'} cx=".28" cy=".13" r=".8">
          <stop stopColor="#fff" stopOpacity=".4" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="40" cy="71" rx="20" ry="2.4" fill="#000" opacity=".16" />
      {style.antenna === 'single' && (
        <g>
          <path d="M40 19v-7" stroke={shade} strokeWidth="2.5" />
          <circle cx="40" cy="10" r="3" fill={light} />
        </g>
      )}
      {style.antenna === 'twin' && (
        <g fill={light} stroke={shade} strokeWidth="2">
          <path d="M28 22v-8m24 8v-8" />
          <circle cx="28" cy="12" r="2.5" />
          <circle cx="52" cy="12" r="2.5" />
        </g>
      )}
      <ellipse
        cx="40"
        cy="43"
        rx="26"
        ry="25.5"
        fill={'url(#' + prefix + '-shell)'}
        stroke={shade}
        strokeWidth=".55"
      />
      <ellipse cx="40" cy="42" rx="24.7" ry="24.3" fill={'url(#' + prefix + '-reflection)'} />
      <path
        d="M22 29c4-5 9-7 15-7"
        stroke="#fff"
        strokeOpacity=".46"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <g className="robot-gaze" fill={style.eyes}>
        <g className="robot-eyes">
          {style.face === 'round' && (
            <>
              <rect x="29" y="35" width="6" height="12" rx="3" />
              <rect x="45" y="35" width="6" height="12" rx="3" />
            </>
          )}
          {style.face === 'visor' && (
            <>
              <rect x="26" y="38" width="10" height="4" rx="2" />
              <rect x="44" y="38" width="10" height="4" rx="2" />
            </>
          )}
          {style.face === 'pixels' && (
            <>
              <rect x="28" y="36" width="7" height="9" rx="1.3" />
              <rect x="45" y="36" width="7" height="9" rx="1.3" />
            </>
          )}
        </g>
        <path
          className="robot-mouth-smile"
          d="M34 52q6 5 12 0"
          fill="none"
          stroke={style.eyes}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <ellipse className="robot-mouth-open" cx="40" cy="53" rx="3.5" ry="2.7" />
        <path
          className="robot-mouth-neutral"
          d="M36 53h8"
          fill="none"
          stroke={style.eyes}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
