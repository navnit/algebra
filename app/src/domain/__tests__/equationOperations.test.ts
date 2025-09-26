import { describe, expect, it } from 'vitest';
import {
  combineConstantsOnSide,
  combineProductConstants,
  distributeConstant,
  divideByLeadingFactor,
  moveConstantAcrossEquals,
  parseEquation,
} from '../equation';
import { math } from '../math';
import { constantValue, isConstant } from '../nodeUtils';

type EquationStateType = ReturnType<typeof parseEquation>;

function findConstantId(
  state: EquationStateType,
  side: 'left' | 'right',
  predicate: (value: ReturnType<typeof constantValue>) => boolean,
) {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const parents = side === 'left' ? state.present.leftParents : state.present.rightParents;
  for (const [id, node] of map.entries()) {
    if (isConstant(node)) {
      let value = constantValue(node);
      let currentId: string | null = id;
      while (currentId) {
        const parentInfo = parents.get(currentId);
        if (!parentInfo?.id) {
          break;
        }
        const parent = map.get(parentInfo.id);
        if ((parent as any)?.isOperatorNode) {
          const fn = (parent as any).fn;
          if (fn === 'unaryMinus') {
            value = math.multiply(math.fraction(-1), value) as ReturnType<typeof constantValue>;
          } else if (fn === 'subtract' && parentInfo.relation === 'args[1]') {
            value = math.multiply(math.fraction(-1), value) as ReturnType<typeof constantValue>;
          }
        }
        currentId = parentInfo.id;
      }
      if (predicate(value)) {
        return id;
      }
    }
  }
  const available = Array.from(map.entries())
    .filter(([, node]) => isConstant(node))
    .map(([, node]) => node.toString())
    .join(', ');
  throw new Error(`Constant not found (available: ${available})`);
}

function findParenthesisId(state: EquationStateType, side: 'left' | 'right', tex: string) {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const targetTex = math.parse(tex).toTex();
  for (const [id, node] of map.entries()) {
    if ((node as any).isParenthesisNode && node.toTex() === targetTex) {
      return id;
    }
  }
  const available = Array.from(map.entries())
    .filter(([, node]) => (node as any).isParenthesisNode)
    .map(([, node]) => node.toTex())
    .join(', ');
  throw new Error(`Group not found (available: ${available})`);
}

describe('equation operations', () => {
  it('moves constant across equals and simplifies scenario 1', () => {
    const initial = parseEquation('2x + 5 = 7');
    const constantId = findConstantId(initial, 'left', (value) => Number(value.valueOf()) === 5);

    const afterMove = moveConstantAcrossEquals(initial, 'left', constantId);
    expect(afterMove.present.left.toString()).toBe('2/1 x');
    expect(afterMove.present.right.toString()).toBe('7/1 - 5/1');

    const factorId = findConstantId(afterMove, 'left', (value) => Number(value.valueOf()) === 2);
    const afterDivide = divideByLeadingFactor(afterMove, 'left', factorId);
    expect(afterDivide.present.left.toString()).toBe('x');
    expect(afterDivide.present.right.toString()).toBe('(7/1 - 5/1) / 2/1');

    const sevenId = findConstantId(afterDivide, 'right', (value) => Number(value.valueOf()) === 7);
    const fiveId = findConstantId(afterDivide, 'right', (value) => Number(value.valueOf()) === -5);
    const simplified = combineConstantsOnSide(afterDivide, 'right', sevenId, fiveId);
    expect(simplified.present.right.toString()).toBe('1/1');
    expect(simplified.present.left.toString()).toBe('x');
  });

  it('distributes, moves constants, and divides scenario 2', () => {
    const initial = parseEquation('3(x+2) = 9');
    const factorId = findConstantId(initial, 'left', (value) => Number(value.valueOf()) === 3);
    const groupId = findParenthesisId(initial, 'left', '(x+2)');

    const distributed = distributeConstant(initial, 'left', factorId, groupId);
    expect(distributed.present.left.toString()).toBe('3/1 x + 6/1');

    const sixId = findConstantId(distributed, 'left', (value) => Number(value.valueOf()) === 6);
    const moved = moveConstantAcrossEquals(distributed, 'left', sixId);
    expect(moved.present.right.toString()).toBe('9/1 - 6/1');

    const nineId = findConstantId(moved, 'right', (value) => Number(value.valueOf()) === 9);
    const minusSixId = findConstantId(moved, 'right', (value) => Number(value.valueOf()) === -6);
    const simplifiedRight = combineConstantsOnSide(moved, 'right', nineId, minusSixId);
    expect(simplifiedRight.present.right.toString()).toBe('3/1');

    const threeId = findConstantId(simplifiedRight, 'left', (value) => Number(value.valueOf()) === 3);
    const finalState = divideByLeadingFactor(simplifiedRight, 'left', threeId);
    expect(finalState.present.left.toString()).toBe('x');
    expect(finalState.present.right.toString()).toBe('1/1');
  });

  it('preserves grouping in scenario 3', () => {
    const state = parseEquation('2(x+3) + 4x = 7 - (x-1)');
    expect(state.present.left.toString()).toBe('2/1 (x + 3/1) + 4/1 x');
    expect(state.present.right.toString()).toBe('7/1 - (x - 1/1)');
  });

  it('distributes negatives correctly scenario 4', () => {
    const first = parseEquation('-3(x-2)=0');
    const factorId = findConstantId(first, 'left', (value) => Number(value.valueOf()) === -3);
    const groupId = findParenthesisId(first, 'left', '(x-2)');
    const distributed = distributeConstant(first, 'left', factorId, groupId);
    expect(distributed.present.left.toString()).toBe('-3/1 x + 6/1');

    const productState = parseEquation('-2*3*(x+4)=0');
    const negTwoId = findConstantId(productState, 'left', (value) => Number(value.valueOf()) === -2);
    const threeId = findConstantId(productState, 'left', (value) => Number(value.valueOf()) === 3);
    const combined = combineProductConstants(productState, 'left', negTwoId, threeId);
    expect(combined.present.left.toString()).toBe('-6/1 (x + 4/1)');

    const chainState = parseEquation('-2*3*5*(x+1)=0');
    const chainNegTwoId = findConstantId(chainState, 'left', (value) => Number(value.valueOf()) === -2);
    const chainThreeId = findConstantId(chainState, 'left', (value) => Number(value.valueOf()) === 3);
    const stepOne = combineProductConstants(chainState, 'left', chainNegTwoId, chainThreeId);
    const sixId = findConstantId(stepOne, 'left', (value) => Number(value.valueOf()) === -6);
    const fiveId = findConstantId(stepOne, 'left', (value) => Number(value.valueOf()) === 5);
    const stepTwo = combineProductConstants(stepOne, 'left', sixId, fiveId);
    expect(stepTwo.present.left.toString()).toBe('-30/1 (x + 1/1)');
  });

  it('keeps negatives unsimplified when moved across equals', () => {
    const state = parseEquation('-6x - 24 = 10');
    const constantId = findConstantId(state, 'left', (value) => Number(value.valueOf()) === -24);
    const moved = moveConstantAcrossEquals(state, 'left', constantId);
    expect(moved.present.left.toString()).toBe('-6/1 x');
    expect(moved.present.right.toString()).toBe('10/1 - (-24/1)');
  });
});
