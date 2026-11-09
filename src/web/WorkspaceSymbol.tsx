type Kind = 'inbox' | 'feature' | 'agents' | 'changes';

export function WorkspaceSymbol({ kind }: { kind: Kind }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'inbox' && (
        <>
          <path d="M5 4h14l2 10v6H3v-6L5 4Z" />
          <path d="M3 14h5l2 3h4l2-3h5M8 8h8M9 11h6" />
        </>
      )}
      {kind === 'feature' && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <path d="m7 9 1.5 1.5L11 7M13 9h4M7 15h10M7 18h6" />
        </>
      )}
      {kind === 'agents' && (
        <>
          <rect x="8" y="2" width="8" height="6" rx="2" />
          <rect x="2" y="16" width="8" height="6" rx="2" />
          <rect x="14" y="16" width="8" height="6" rx="2" />
          <path d="M12 8v4M6 16v-4h12v4M11 5h2M5 19h2M17 19h2" />
        </>
      )}
      {kind === 'changes' && (
        <>
          <circle cx="7" cy="5" r="2.5" />
          <circle cx="17" cy="6" r="2.5" />
          <circle cx="7" cy="19" r="2.5" />
          <path d="M7 7.5v9M17 8.5v1A5.5 5.5 0 0 1 11.5 15H7" />
        </>
      )}
    </svg>
  );
}
