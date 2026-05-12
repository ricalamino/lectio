"use client";

export function SearchAnswerText({ text }: { text: string }) {
  const re = /(#[a-fA-F0-9]{8})/g;
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > i) nodes.push(text.slice(i, idx));
    nodes.push(
      <mark
        key={key++}
        className="rounded bg-amber-500/20 px-0.5 font-mono text-[0.85em] text-amber-100"
      >
        {m[0]}
      </mark>,
    );
    i = idx + m[0].length;
  }
  if (i < text.length) nodes.push(text.slice(i));
  return <span className="whitespace-pre-wrap">{nodes}</span>;
}
