'use client';

const BODY = '#1c1c1c';
const EDGE = 'rgba(255,255,255,0.10)';

// Farveskala efter antal sæt i denne uge
function heat(sets: number): string {
  if (sets <= 0)  return '#2e2e2e';
  if (sets <= 3)  return '#7c3a12';
  if (sets <= 6)  return '#c2570a';
  if (sets <= 10) return '#f97316';
  return '#ef4444';
}

const FRONT_GROUPS = ['Bryst', 'Skulder', 'Biceps', 'Core', 'Ben'];
const BACK_GROUPS  = ['Ryg', 'Skulder', 'Triceps', 'Ben'];

function Silhouette() {
  return (
    <g fill={BODY} stroke={EDGE} strokeWidth="1">
      <circle cx="50" cy="16" r="11" />
      <rect x="45" y="24" width="10" height="10" rx="3" />
      <rect x="30" y="32" width="40" height="64" rx="13" />
      <rect x="33" y="90" width="34" height="20" rx="9" />
      <rect x="16" y="37" width="13" height="56" rx="6.5" />
      <rect x="71" y="37" width="13" height="56" rx="6.5" />
      <rect x="34" y="104" width="14" height="90" rx="7" />
      <rect x="52" y="104" width="14" height="90" rx="7" />
      <rect x="31" y="192" width="17" height="9" rx="4" />
      <rect x="52" y="192" width="17" height="9" rx="4" />
    </g>
  );
}

export default function MuscleHeatmap({ sets }: { sets: Record<string, number> }) {
  const f = (cat: string) => heat(sets[cat] ?? 0);
  const legend = [...FRONT_GROUPS, ...BACK_GROUPS.filter(c => !FRONT_GROUPS.includes(c))];

  return (
    <div>
      <div className="flex justify-center gap-2">
        {([
          { label: 'Forfra', body: (
            <g stroke="rgba(0,0,0,0.35)" strokeWidth="0.6">
              <ellipse cx="28" cy="42" rx="9" ry="8" fill={f('Skulder')} />
              <ellipse cx="72" cy="42" rx="9" ry="8" fill={f('Skulder')} />
              <rect x="33" y="38" width="16" height="20" rx="6" fill={f('Bryst')} />
              <rect x="51" y="38" width="16" height="20" rx="6" fill={f('Bryst')} />
              <ellipse cx="22" cy="60" rx="6" ry="12" fill={f('Biceps')} />
              <ellipse cx="78" cy="60" rx="6" ry="12" fill={f('Biceps')} />
              <rect x="38" y="61" width="24" height="33" rx="8" fill={f('Core')} />
              <rect x="35" y="108" width="12" height="46" rx="6" fill={f('Ben')} />
              <rect x="53" y="108" width="12" height="46" rx="6" fill={f('Ben')} />
            </g>
          ) },
          { label: 'Bagfra', body: (
            <g stroke="rgba(0,0,0,0.35)" strokeWidth="0.6">
              <ellipse cx="28" cy="42" rx="9" ry="8" fill={f('Skulder')} />
              <ellipse cx="72" cy="42" rx="9" ry="8" fill={f('Skulder')} />
              <rect x="33" y="37" width="34" height="34" rx="11" fill={f('Ryg')} />
              <rect x="37" y="73" width="26" height="20" rx="8" fill={f('Ryg')} />
              <ellipse cx="22" cy="60" rx="6" ry="12" fill={f('Triceps')} />
              <ellipse cx="78" cy="60" rx="6" ry="12" fill={f('Triceps')} />
              <rect x="35" y="94" width="13" height="17" rx="6" fill={f('Ben')} />
              <rect x="52" y="94" width="13" height="17" rx="6" fill={f('Ben')} />
              <rect x="35" y="113" width="12" height="42" rx="6" fill={f('Ben')} />
              <rect x="53" y="113" width="12" height="42" rx="6" fill={f('Ben')} />
            </g>
          ) },
        ]).map(view => (
          <div key={view.label} className="flex-1 max-w-[46%] flex flex-col items-center">
            <svg viewBox="0 0 100 206" className="w-full h-auto max-h-52">
              <Silhouette />
              {view.body}
            </svg>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">{view.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-4">
        {legend.map(cat => {
          const n = sets[cat] ?? 0;
          return (
            <span key={cat}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${n > 0 ? 'text-white' : 'text-gray-500 border-white/10'}`}
              style={n > 0 ? { backgroundColor: `${heat(n)}33`, borderColor: heat(n) } : undefined}>
              {cat} <span className={n > 0 ? 'text-white/70' : 'text-gray-600'}>{n}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
