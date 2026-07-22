import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, actions, headingLevel = 1 }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return (
    <header className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-accent">{eyebrow}</p> : null}
        <Heading className="text-balance font-display text-4xl font-semibold leading-[1.08] text-ink md:text-6xl">{title}</Heading>
        {description ? <p className="mt-4 max-w-2xl text-pretty text-base text-muted md:text-lg">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
