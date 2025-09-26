import { all, create } from 'mathjs';

export const math = create(all, {
  number: 'Fraction',
  precision: 64,
});

export type MathNode = import('mathjs').MathNode;
export type Fraction = import('mathjs').Fraction;

export const fraction = (...args: Parameters<typeof math.fraction>) => math.fraction(...args);
export const simplify = math.simplify;
export const parse = math.parse;
export const derivative = math.derivative;
