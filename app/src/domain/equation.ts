import type { Fraction } from 'mathjs';
import type { MathNode } from './math';
import { parse, math } from './math';
import {
  AnnotatedNodeMap,
  annotate,
  collectAddends,
  collectFactors,
  constantNode,
  constantValue,
  getNodeId,
  isConstant,
  negate,
  parenthesis,
  rebuildProduct,
  rebuildSum,
  subtractNodes,
} from './nodeUtils';
import { fractionToText } from './format';

export type EquationSide = 'left' | 'right';

export interface EquationSnapshot {
  left: MathNode;
  right: MathNode;
  note: string;
}

export interface EquationPresent extends EquationSnapshot {
  leftMap: Map<string, MathNode>;
  rightMap: Map<string, MathNode>;
  leftParents: Map<string, { id: string | null; relation: string | null }>;
  rightParents: Map<string, { id: string | null; relation: string | null }>;
}

export interface EquationState {
  past: EquationSnapshot[];
  present: EquationPresent;
  future: EquationSnapshot[];
  helpersEnabled: boolean;
  message?: string;
  hint?: string;
  preview?: EquationSnapshot | null;
}

export function parseEquation(input: string): EquationState {
  const sanitized = input.replace(/\s+/g, '');
  const parts = sanitized.split('=');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    throw new Error('Equation must contain exactly one "="');
  }
  const leftNode = parse(parts[0]);
  const rightNode = parse(parts[1]);
  const present = buildPresent(leftNode, rightNode, 'Starting equation');
  return {
    past: [],
    present,
    future: [],
    helpersEnabled: true,
    hint: deriveHint(present),
  };
}

function buildPresent(left: MathNode, right: MathNode, note: string): EquationPresent {
  const leftAnnotated: AnnotatedNodeMap = annotate(left, 'L');
  const rightAnnotated: AnnotatedNodeMap = annotate(right, 'R');
  return {
    left: leftAnnotated.root,
    right: rightAnnotated.root,
    note,
    leftMap: leftAnnotated.map,
    rightMap: rightAnnotated.map,
    leftParents: leftAnnotated.parents,
    rightParents: rightAnnotated.parents,
  };
}

function commit(state: EquationState, left: MathNode, right: MathNode, note: string): EquationState {
  const pastEntry: EquationSnapshot = {
    left: state.present.left.clone(),
    right: state.present.right.clone(),
    note: state.present.note,
  };
  const present = buildPresent(left, right, note);
  return {
    past: [...state.past, pastEntry],
    present,
    future: [],
    helpersEnabled: state.helpersEnabled,
    hint: deriveHint(present),
  };
}

export function toggleHelpers(state: EquationState, enabled: boolean): EquationState {
  return {
    ...state,
    helpersEnabled: enabled,
  };
}

export function undo(state: EquationState): EquationState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const futureEntry: EquationSnapshot = {
    left: state.present.left.clone(),
    right: state.present.right.clone(),
    note: state.present.note,
  };
  const newPast = state.past.slice(0, -1);
  const present = buildPresent(previous.left, previous.right, previous.note);
  return {
    past: newPast,
    present,
    future: [futureEntry, ...state.future],
    helpersEnabled: state.helpersEnabled,
    hint: deriveHint(present),
  };
}

export function redo(state: EquationState): EquationState {
  if (state.future.length === 0) return state;
  const [next, ...rest] = state.future;
  const pastEntry: EquationSnapshot = {
    left: state.present.left.clone(),
    right: state.present.right.clone(),
    note: state.present.note,
  };
  const present = buildPresent(next.left, next.right, next.note);
  return {
    past: [...state.past, pastEntry],
    present,
    future: rest,
    helpersEnabled: state.helpersEnabled,
    hint: deriveHint(present),
  };
}

export function clearMessage(state: EquationState): EquationState {
  if (!state.message) return state;
  return { ...state, message: undefined };
}

function deriveHint(present: EquationPresent): string | undefined {
  if (hasExpandableProduct(present.left) || hasExpandableProduct(present.right)) {
    return 'Hint: expand the product.';
  }
  if (hasMovableConstant(present.left) || hasMovableConstant(present.right)) {
    return 'Hint: subtract the constant on the left.';
  }
  if (hasDivisibleLeadingFactor(present.left) || hasDivisibleLeadingFactor(present.right)) {
    return 'Hint: divide both sides by the leading coefficient.';
  }
  if (hasSimplifiableConstant(present.right)) {
    return 'Hint: simplify numbers on the right.';
  }
  return undefined;
}

function hasMovableConstant(node: MathNode): boolean {
  const terms = collectAddends(node);
  return terms.some((term) => isConstant(term));
}

function hasSimplifiableConstant(node: MathNode): boolean {
  const terms = collectAddends(node);
  const constantCount = terms.filter((term) => isConstant(term)).length;
  return constantCount >= 2;
}

function hasDivisibleLeadingFactor(node: MathNode): boolean {
  if (!((node as any).isOperatorNode)) return false;
  const terms = collectAddends(node);
  return terms.some((term) => {
    const factors = collectFactors(term);
    if (factors.length === 0) return false;
    const [first] = factors;
    return isConstant(first);
  });
}

function hasExpandableProduct(node: MathNode): boolean {
  if (!((node as any).isOperatorNode)) return false;
  const terms = collectAddends(node);
  return terms.some((term) => {
    const factors = collectFactors(term);
    return factors.some((factor) => (factor as any).isParenthesisNode) && factors.some((factor) => isConstant(factor));
  });
}

export function moveConstantAcrossEquals(state: EquationState, side: EquationSide, nodeId: string): EquationState {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const node = map.get(nodeId);
  if (!node || !isConstant(node)) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const sourceRoot = side === 'left' ? state.present.left : state.present.right;
  const targetRoot = side === 'left' ? state.present.right : state.present.left;

  const addends = collectAddendRefs(sourceRoot);
  const termIndex = addends.findIndex((term) => term.id === nodeId);
  if (termIndex === -1) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const targetTerm = addends[termIndex];
  const signedValue = math.multiply(constantValue(node), math.fraction(targetTerm.sign)) as Fraction;

  const remainingTerms = addends.filter((_, idx) => idx !== termIndex);
  const newSource = rebuildSum(
    remainingTerms.map((term) => (term.sign === 1 ? term.node.clone() : negate(term.node.clone()))),
  );

  const movedConstantValue = constantNode(signedValue);
  const signValue = Number((signedValue as any).s);
  const isNegativeConstant = signValue === -1;
  const movedConstant = isNegativeConstant ? parenthesis(movedConstantValue) : movedConstantValue;
  const newTarget = subtractNodes(targetRoot, movedConstant);

  const newLeft = side === 'left' ? newSource : newTarget;
  const newRight = side === 'left' ? newTarget : newSource;
  const value = fractionToText(signedValue);
  return commit(state, newLeft, newRight, `Subtract ${value} from both sides`);
}

export function combineLikeTerms(
  state: EquationState,
  side: EquationSide,
  sourceId: string,
  targetId: string,
): EquationState {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const source = map.get(sourceId);
  const target = map.get(targetId);
  if (!source || !target) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const root = side === 'left' ? state.present.left : state.present.right;
  const terms = collectAddends(root);

  const sourceStr = source.toString();
  const targetStr = target.toString();

  let sourceIndex = -1;
  let targetIndex = -1;
  const selectedTerms: MathNode[] = [];

  terms.forEach((term, index) => {
    if (term.toString() === sourceStr && sourceIndex === -1) {
      sourceIndex = index;
      selectedTerms.push(term);
    } else if (term.toString() === targetStr && targetIndex === -1) {
      targetIndex = index;
      selectedTerms.push(term);
    }
  });

  if (sourceIndex === -1 || targetIndex === -1 || selectedTerms.length !== 2) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const combo = addTermsIfLike(selectedTerms[0], selectedTerms[1]);
  if (!combo) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const remainingTerms = terms.filter((_, index) => index !== sourceIndex && index !== targetIndex);
  remainingTerms.splice(Math.min(sourceIndex, targetIndex), 0, combo);

  const newSide = rebuildSum(remainingTerms);
  const newLeft = side === 'left' ? newSide : state.present.left.clone();
  const newRight = side === 'right' ? newSide : state.present.right.clone();

  return commit(state, newLeft, newRight, 'Combine like terms');
}

function addTermsIfLike(a: MathNode, b: MathNode): MathNode | null {
  const first = decomposeSingleSymbolTerm(a);
  const second = decomposeSingleSymbolTerm(b);
  if (!first || !second) return null;
  if (first.symbol.toString() !== second.symbol.toString()) return null;
  const sum = math.add(first.coefficient, second.coefficient) as Fraction;
  if (sum.n === 0n) {
    return constantNode(0);
  }
  if (sum.d === 1n && sum.n === 1n) {
    return first.symbol.clone();
  }
  if (sum.d === 1n && sum.n === -1n) {
    return new math.OperatorNode('-', 'unaryMinus', [first.symbol.clone()]);
  }
  return rebuildProduct([constantNode(sum), first.symbol.clone()]);
}

interface LikeTerm {
  coefficient: Fraction;
  symbol: MathNode;
}

function decomposeSingleSymbolTerm(node: MathNode): LikeTerm | null {
  if ((node as any).isParenthesisNode) return null;
  const factors = collectFactors(node);
  let symbol: MathNode | null = null;
  let coefficient = math.fraction(1) as Fraction;
  for (const factor of factors) {
    if ((factor as any).isSymbolNode) {
      if (symbol) return null;
      if ((factor as any).name?.length !== 1) return null;
      symbol = factor.clone();
      continue;
    }
    if (isConstant(factor)) {
      coefficient = math.multiply(coefficient, constantValue(factor)) as Fraction;
      continue;
    }
    return null;
  }
  if (!symbol) return null;
  return { coefficient, symbol };
}

export function divideByLeadingFactor(state: EquationState, side: EquationSide, factorId: string): EquationState {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const factor = map.get(factorId);
  if (!factor || !isConstant(factor)) {
    return { ...state, message: 'That step isn\'t valid here' };
  }
  const value = constantValue(factor);
  if (value.n === 0n) {
    return { ...state, message: 'Can’t divide by 0' };
  }

  const root = side === 'left' ? state.present.left : state.present.right;
  const terms = collectAddends(root);
  const factorStr = factor.toString();
  let updated = false;
  const newTerms = terms.map((term) => {
    if (updated) return term;
    const factors = collectFactors(term);
    if (factors.length === 0) return term;
    const first = factors[0];
    if (first.toString() === factorStr) {
      updated = true;
      const remaining = factors.slice(1);
      return rebuildProduct(remaining);
    }
    return term;
  });

  if (!updated) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const newSide = rebuildSum(newTerms);
  const divisor = factor.clone();
  const other = side === 'left' ? state.present.right.clone() : state.present.left.clone();
  const dividedOther = new math.OperatorNode('/', 'divide', [other, divisor]);
  const normalizedSide = evaluateIfFullyConstant(newSide);
  const normalizedOther = isConstant(other)
    ? evaluateIfFullyConstant(dividedOther)
    : dividedOther;
  const newLeft = side === 'left' ? normalizedSide : normalizedOther;
  const newRight = side === 'left' ? normalizedOther : normalizedSide;
  return commit(state, newLeft, newRight, `Divide both sides by ${fractionToText(value)}`);
}

type AddendRef = {
  id?: string;
  node: MathNode;
  sign: 1 | -1;
};

type FactorRef = {
  id?: string;
  node: MathNode;
};

function flipSign(sign: 1 | -1): 1 | -1 {
  return (sign === 1 ? -1 : 1) as 1 | -1;
}

function collectAddendRefs(node: MathNode, sign: 1 | -1 = 1): AddendRef[] {
  if ((node as any).isParenthesisNode) {
    return collectAddendRefs((node as any).content, sign);
  }

  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    if (opNode.fn === 'add') {
      return opNode.args.flatMap((arg: MathNode) => collectAddendRefs(arg, sign));
    }
    if (opNode.fn === 'subtract') {
      const [a, b] = opNode.args as MathNode[];
      return [...collectAddendRefs(a, sign), ...collectAddendRefs(b, flipSign(sign))];
    }
  }

  return [
    {
      id: getNodeId(node),
      node,
      sign,
    },
  ];
}

function collectFactorRefs(node: MathNode): FactorRef[] {
  if ((node as any).isParenthesisNode) {
    return [
      {
        id: getNodeId(node),
        node,
      },
    ];
  }

  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    if (opNode.fn === 'multiply') {
      return opNode.args.flatMap((arg: MathNode) => collectFactorRefs(arg));
    }
    if (opNode.fn === 'unaryMinus') {
      return [
        {
          id: getNodeId(node),
          node,
        },
      ];
    }
  }

  return [
    {
      id: getNodeId(node),
      node,
    },
  ];
}

function collectOperatorAncestors(
  startId: string,
  map: Map<string, MathNode>,
  parents: Map<string, { id: string | null; relation: string | null }>,
  allowedFns: string[],
): string[] {
  const ancestors: string[] = [];
  let current: string | null = startId;
  while (current) {
    const info = parents.get(current);
    if (!info?.id) {
      break;
    }
    const parentNode = map.get(info.id);
    if ((parentNode as any)?.isOperatorNode) {
      const fn = (parentNode as any).fn;
      if (allowedFns.includes(fn)) {
        ancestors.push(info.id);
      }
    }
    current = info.id;
  }
  return ancestors;
}

function findLowestSharedOperatorAncestor(
  sourceId: string,
  targetId: string,
  map: Map<string, MathNode>,
  parents: Map<string, { id: string | null; relation: string | null }>,
  allowedFns: string[],
): string | null {
  const sourceAncestors = collectOperatorAncestors(sourceId, map, parents, allowedFns);
  const targetAncestors = new Set(collectOperatorAncestors(targetId, map, parents, allowedFns));
  for (const ancestor of sourceAncestors) {
    if (targetAncestors.has(ancestor)) {
      return ancestor;
    }
  }
  return null;
}

function findLowestSharedAdditiveAncestor(
  sourceId: string,
  targetId: string,
  map: Map<string, MathNode>,
  parents: Map<string, { id: string | null; relation: string | null }>,
): string | null {
  return findLowestSharedOperatorAncestor(sourceId, targetId, map, parents, ['add', 'subtract']);
}

function findLowestSharedMultiplicativeAncestor(
  sourceId: string,
  targetId: string,
  map: Map<string, MathNode>,
  parents: Map<string, { id: string | null; relation: string | null }>,
): string | null {
  return findLowestSharedOperatorAncestor(sourceId, targetId, map, parents, ['multiply']);
}

function findTopMultiplyAncestor(
  startId: string,
  map: Map<string, MathNode>,
  parents: Map<string, { id: string | null; relation: string | null }>,
): string {
  let current = startId;
  let result = startId;
  while (true) {
    const info = parents.get(current);
    if (!info?.id) {
      break;
    }
    const parentNode = map.get(info.id);
    if ((parentNode as any)?.isOperatorNode && (parentNode as any).fn === 'multiply') {
      result = info.id;
      current = info.id;
    } else {
      break;
    }
  }
  return result;
}

function replaceNodeById(node: MathNode, targetId: string, replacer: () => MathNode): MathNode {
  if (getNodeId(node) === targetId) {
    return replacer();
  }
  if (typeof (node as any).map === 'function') {
    return (node as any).map((child: MathNode) => replaceNodeById(child, targetId, replacer));
  }
  return node.clone();
}

function isFullyConstantNode(node: MathNode): boolean {
  let constant = true;
  node.traverse((child: MathNode) => {
    if ((child as any).isSymbolNode) {
      constant = false;
    }
  });
  return constant;
}

function evaluateIfFullyConstant(node: MathNode): MathNode {
  if (!isFullyConstantNode(node)) {
    return node;
  }
  const evaluated = node.evaluate();
  const fractionValue = math.fraction(evaluated as any);
  return constantNode(fractionValue);
}

export function combineConstantsOnSide(
  state: EquationState,
  side: EquationSide,
  sourceId: string,
  targetId: string,
): EquationState {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const parents = side === 'left' ? state.present.leftParents : state.present.rightParents;
  const source = map.get(sourceId);
  const target = map.get(targetId);
  if (!source || !target || !isConstant(source) || !isConstant(target)) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const additiveParentId = findLowestSharedAdditiveAncestor(sourceId, targetId, map, parents);
  if (!additiveParentId) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const additionNode = map.get(additiveParentId);
  if (!additionNode) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const addends = collectAddendRefs(additionNode);
  const sourceIndex = addends.findIndex((term) => term.id === sourceId);
  const targetIndex = addends.findIndex((term) => term.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const sourceContribution = math.multiply(
    constantValue(source),
    math.fraction(addends[sourceIndex].sign),
  ) as Fraction;
  const targetContribution = math.multiply(
    constantValue(target),
    math.fraction(addends[targetIndex].sign),
  ) as Fraction;
  const combinedValue = math.add(sourceContribution, targetContribution) as Fraction;

  const firstIndex = Math.min(sourceIndex, targetIndex);
  const filtered = addends.filter((_, index) => index !== sourceIndex && index !== targetIndex);
  if (combinedValue.n !== 0n) {
    filtered.splice(firstIndex, 0, {
      node: constantNode(combinedValue),
      sign: 1,
    });
  }

  const replacementNode = rebuildSum(
    filtered.map((term) => (term.sign === 1 ? term.node.clone() : negate(term.node.clone()))),
  );

  const sideRoot = side === 'left' ? state.present.left : state.present.right;
  const updatedSide = replaceNodeById(sideRoot, additiveParentId, () => replacementNode.clone());
  const normalizedSide = evaluateIfFullyConstant(updatedSide);

  const newLeft = side === 'left' ? normalizedSide : state.present.left.clone();
  const newRight = side === 'right' ? normalizedSide : state.present.right.clone();
  return commit(state, newLeft, newRight, 'Combine constants');
}

export function combineProductConstants(
  state: EquationState,
  side: EquationSide,
  sourceId: string,
  targetId: string,
): EquationState {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const parents = side === 'left' ? state.present.leftParents : state.present.rightParents;
  const source = map.get(sourceId);
  const target = map.get(targetId);
  if (!source || !target || !isConstant(source) || !isConstant(target)) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const productAncestorId = findLowestSharedMultiplicativeAncestor(sourceId, targetId, map, parents);
  if (!productAncestorId) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const topProductId = findTopMultiplyAncestor(productAncestorId, map, parents);
  const productNode = map.get(topProductId);
  if (!productNode || !(productNode as any).isOperatorNode) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const factors = collectFactorRefs(productNode);
  const sourceIndex = factors.findIndex((factor) => factor.id === sourceId);
  const targetIndex = factors.findIndex((factor) => factor.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const productValue = math.multiply(constantValue(source), constantValue(target)) as Fraction;
  const firstIndex = Math.min(sourceIndex, targetIndex);
  const filtered = factors.filter((_, idx) => idx !== sourceIndex && idx !== targetIndex);
  const isOne = productValue.s === 1 && productValue.n === 1n && productValue.d === 1n;
  if (!isOne || filtered.length === 0) {
    filtered.splice(firstIndex, 0, { node: constantNode(productValue) });
  }

  const replacementProduct = rebuildProduct(filtered.map((factor) => factor.node.clone()));
  const root = side === 'left' ? state.present.left : state.present.right;
  const updatedSide = replaceNodeById(root, topProductId, () => replacementProduct.clone());
  const normalizedSide = evaluateIfFullyConstant(updatedSide);
  const newLeft = side === 'left' ? normalizedSide : state.present.left.clone();
  const newRight = side === 'right' ? normalizedSide : state.present.right.clone();
  return commit(state, newLeft, newRight, 'Multiply constants');
}

export function distributeConstant(
  state: EquationState,
  side: EquationSide,
  factorId: string,
  groupId: string,
): EquationState {
  const map = side === 'left' ? state.present.leftMap : state.present.rightMap;
  const parents = side === 'left' ? state.present.leftParents : state.present.rightParents;
  const factor = map.get(factorId);
  const group = map.get(groupId);
  if (!factor || !group || !isConstant(factor) || !(group as any).isParenthesisNode) {
    return { ...state, message: 'Need a constant and a (group) to distribute' };
  }

  const productAncestorId = findLowestSharedMultiplicativeAncestor(factorId, groupId, map, parents);
  if (!productAncestorId) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const topProductId = findTopMultiplyAncestor(productAncestorId, map, parents);
  const productNode = map.get(topProductId);
  if (!productNode || !(productNode as any).isOperatorNode) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const productArgs = ((productNode as any).args as MathNode[]) || [];
  const factorArgIndex = productArgs.findIndex((arg) => getNodeId(arg) === factorId);
  const groupArgIndex = productArgs.findIndex((arg) => getNodeId(arg) === groupId);
  if (factorArgIndex === -1 || groupArgIndex === -1) {
    return { ...state, message: 'That step isn\'t valid here' };
  }

  const remainingFactors = productArgs
    .map((arg, index) => ({ arg, index }))
    .filter((item) => item.index !== factorArgIndex && item.index !== groupArgIndex)
    .map((item) => item.arg);

  const groupContent = (group as any).content as MathNode;
  const addends = collectAddends(groupContent, { unwrapParenthesis: true });
  const distributedTerms = addends.map((addend) => {
    let baseTerm: MathNode;
    if (isConstant(addend)) {
      const productValue = math.multiply(constantValue(factor), constantValue(addend)) as Fraction;
      baseTerm = constantNode(productValue);
    } else {
      baseTerm = rebuildProduct([factor.clone(), addend.clone()]);
    }

    if (remainingFactors.length === 0) {
      return baseTerm;
    }

    const factorsForTerm = [...remainingFactors.map((node) => node.clone()), baseTerm];
    return rebuildProduct(factorsForTerm);
  });

  const replacement = rebuildSum(distributedTerms);
  const root = side === 'left' ? state.present.left : state.present.right;
  const updatedSide = replaceNodeById(root, topProductId, () => replacement.clone());
  const normalizedSide = evaluateIfFullyConstant(updatedSide);
  const newLeft = side === 'left' ? normalizedSide : state.present.left.clone();
  const newRight = side === 'right' ? normalizedSide : state.present.right.clone();
  const value = fractionToText(constantValue(factor));
  return commit(state, newLeft, newRight, `Distribute ${value}`);
}
