export const CATEGORY_ORDER = ['Bryst', 'Ryg', 'Skulder', 'Biceps', 'Triceps', 'Ben', 'Core', 'Cardio', 'Helkrop'];

export function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

// Datoer gemmes som lokal dato, så en træning kl. 23 ikke lander på gårsdagen (UTC).
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string { return toISODate(new Date()); }

export function getMondayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  return toISODate(d);
}

// Fordeler øvelserne så to øvelser med samme muskelgruppe ikke ligger lige efter hinanden.
// Vælger hver gang den gruppe der har flest tilbage, så det ikke klumper til sidst.
export function spreadCategories<T extends { category: string | null }>(list: T[]): T[] {
  const remaining = [...list];
  const out: T[] = [];
  let prev: string | null = null;

  while (remaining.length) {
    const counts = new Map<string | null, number>();
    for (const ex of remaining) counts.set(ex.category, (counts.get(ex.category) ?? 0) + 1);

    let pick = -1;
    let pickCount = -1;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].category === prev) continue;
      const c = counts.get(remaining[i].category) ?? 0;
      if (c > pickCount) { pickCount = c; pick = i; }
    }
    if (pick === -1) pick = 0; // kun samme muskelgruppe tilbage

    const [picked] = remaining.splice(pick, 1);
    out.push(picked);
    prev = picked.category;
  }
  return out;
}
