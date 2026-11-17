import { useState } from 'react';

function cut(value: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= 80) return { text, shortened: false };
  return { text: `${text.slice(0, 80).trimEnd()}…`, shortened: true };
}

export function TextExcerpt({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const full = text.replace(/\s+/g, ' ').trim();
  if (!full) return <>—</>;
  const shown = cut(full);
  if (!shown.shortened) return <span>{shown.text}</span>;
  return (
    <button type="button" className="text-left" onClick={() => setOpen((current) => !current)}>
      <span className="whitespace-pre-wrap">{open ? full : shown.text}</span>
      <span className="mt-1 block text-xs font-medium text-primary hover:underline">{open ? 'Masquer' : 'Voir la suite'}</span>
    </button>
  );
}

export function LineExcerpt({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  const items = lines.map((line) => line.trim()).filter(Boolean);
  if (!items.length) return <>—</>;
  const first = cut(items[0]);
  const hidden = items.length > 1 || first.shortened;
  if (!hidden) return <p>{items[0]}</p>;
  return (
    <button type="button" className="text-left" onClick={() => setOpen((current) => !current)}>
      {open ? items.map((line, index) => <p key={`${index}-${line}`}>{line}</p>) : <p>{first.text}</p>}
      <span className="mt-1 block text-xs font-medium text-primary hover:underline">{open ? 'Masquer' : 'Voir la suite'}</span>
    </button>
  );
}
