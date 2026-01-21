import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

export default function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        ) : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
