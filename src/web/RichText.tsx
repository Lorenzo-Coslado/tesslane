import { memo, type ReactNode } from 'react';

// A deliberately small Markdown subset. Raw HTML is always rendered as text.
function inline(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s]+\))/g);
  return tokens.map((token, i) => {
    if (token.startsWith('`') && token.endsWith('`'))
      return <code key={i}>{token.slice(1, -1)}</code>;
    if (token.startsWith('**') && token.endsWith('**'))
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^\s]+)\)$/.exec(token);
    if (link) {
      if (/^https?:\/\//i.test(link[2]))
        return (
          <a key={i} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        );
      return (
        <span key={i} title={link[2]}>
          {link[1]} <code>{link[2]}</code>
        </span>
      );
    }
    return token;
  });
}

export const RichText = memo(function RichText({ text }: { text: string }) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const key = i;
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(
        <pre key={key}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push(<h4 key={key}>{inline(line.replace(/^#{1,6}\s+/, ''))}</h4>);
      i++;
    } else if (/^\s*(?:[-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s/ : /^\s*[-*]\s/).test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i++].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''))}</li>);
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    } else {
      const paragraph: string[] = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\s*(?:```|#{1,6}\s|[-*]\s|\d+\.\s)/.test(lines[i])
      )
        paragraph.push(lines[i++]);
      blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
    }
  }
  return <div className="rich-text">{blocks}</div>;
});
