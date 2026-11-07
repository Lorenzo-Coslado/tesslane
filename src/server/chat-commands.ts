export type Command =
  | {
      kind: 'plan' | 'execute' | 'pause' | 'resume' | 'stop' | 'status' | 'retry' | 'integrate';
      argument?: string;
    }
  | { kind: 'create_feature'; title: string; description: string }
  | { kind: 'profile'; profile: 'fast' | 'balanced' | 'deep' };
export function parseCommand(content: string): Command {
  const [head, ...tail] = content.trim().split(/\s+/);
  const argument = tail.join(' ');
  const names: Record<string, Command['kind']> = {
    '/plan': 'plan',
    '/run': 'execute',
    '/pause': 'pause',
    '/resume': 'resume',
    '/stop': 'stop',
    '/status': 'status',
    '/retry': 'retry',
    '/integrate': 'integrate',
  };
  if (head === '/feature') {
    const [title, ...lines] = content.slice(head.length).trim().split('\n');
    if (!title) throw new Error('Use /feature Title followed by a description on the next line.');
    return { kind: 'create_feature', title, description: lines.join('\n').trim() || title };
  }
  if (head === '/profile') {
    if (!['fast', 'balanced', 'deep'].includes(argument))
      throw new Error('Use /profile fast, balanced or deep.');
    return { kind: 'profile', profile: argument as 'fast' | 'balanced' | 'deep' };
  }
  if (!names[head])
    throw new Error(
      'Unknown command. Use /feature, /plan, /run, /pause, /resume, /stop, /status, /retry, /integrate or /profile.',
    );
  return {
    kind: names[head] as
      'plan' | 'execute' | 'pause' | 'resume' | 'stop' | 'status' | 'retry' | 'integrate',
    argument: argument || undefined,
  };
}
