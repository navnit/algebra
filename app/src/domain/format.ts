import type { Fraction } from 'mathjs';

export function fractionToText(value: Fraction): string {
  const sign = value.s < 0 ? '-' : '';
  const numerator = value.n.toString();
  const denominator = value.d.toString();
  if (denominator === '1') {
    return `${sign}${numerator}`;
  }
  return `${sign}${numerator}/${denominator}`;
}
