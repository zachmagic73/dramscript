export type PreferredUnit = 'oz' | 'ml';

const ML_PER_OZ = 29.5735;

function trimNumber(value: number, maxDecimals: number): string {
  return value
    .toFixed(maxDecimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
}

export function formatAmountWithPreference(
  amount: number | null | undefined,
  unit: string | null | undefined,
  preferred: PreferredUnit,
): string {
  if (amount == null) return '';

  const normalized = (unit ?? '').toLowerCase();

  if (normalized === 'ml' && preferred === 'oz') {
    const oz = amount / ML_PER_OZ;
    return `${trimNumber(oz, 2)} oz`;
  }

  if (normalized === 'oz' && preferred === 'ml') {
    const ml = amount * ML_PER_OZ;
    const rounded = ml >= 10 ? Math.round(ml) : Number(trimNumber(ml, 1));
    return `${rounded} ml`;
  }

  return `${trimNumber(amount, 2)}${unit ? ` ${unit}` : ''}`;
}
