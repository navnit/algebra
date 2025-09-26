import type { Fraction } from 'mathjs';
import type { MathNode } from './math';
import { math } from './math';

const NODE_ID = Symbol('nodeId');
let idSeed = 0;

export interface AnnotatedNodeMap {
  root: MathNode;
  map: Map<string, MathNode>;
  parents: Map<string, { id: string | null; relation: string | null }>; 
}

export const zeroNode = () => new math.ConstantNode(math.fraction(0));

export function annotate(node: MathNode, prefix = 'n'): AnnotatedNodeMap {
  const cloned = node.clone();
  const map = new Map<string, MathNode>();
  const parents = new Map<string, { id: string | null; relation: string | null }>();

  function walk(current: MathNode, parentId: string | null, relation: string | null) {
    const id = `${prefix}-${idSeed++}`;
    (current as any)[NODE_ID] = id;
    map.set(id, current);
    parents.set(id, { id: parentId, relation });
    if (typeof (current as any).forEach === 'function') {
      current.forEach((child: MathNode, path: string) => {
        walk(child, id, path);
      });
    }
  }

  walk(cloned, null, null);
  return { root: cloned, map, parents };
}

export function getNodeId(node: MathNode): string | undefined {
  return (node as any)[NODE_ID];
}

export function cloneWithNewIds(node: MathNode, prefix = 'n'): AnnotatedNodeMap {
  return annotate(node.clone(), prefix);
}

export function isConstant(node: MathNode): boolean {
  if ((node as any).isParenthesisNode) {
    return isConstant((node as any).content);
  }
  if ((node as any).isConstantNode) return true;
  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    return opNode.fn === 'unaryMinus' && isConstant(opNode.args[0]);
  }
  return false;
}

export function constantValue(node: MathNode): Fraction {
  if ((node as any).isParenthesisNode) {
    return constantValue((node as any).content);
  }
  if ((node as any).isConstantNode) {
    return (node as any).value as Fraction;
  }
  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    if (opNode.fn === 'unaryMinus') {
      return math.multiply(math.fraction(-1), constantValue(opNode.args[0])) as Fraction;
    }
  }
  throw new Error('Node is not constant');
}

export function negate(node: MathNode): MathNode {
  return new math.OperatorNode('-', 'unaryMinus', [node.clone()]);
}

export function subtractNodes(left: MathNode, right: MathNode): MathNode {
  return new math.OperatorNode('-', 'subtract', [left.clone(), right.clone()]);
}

export function addNodes(left: MathNode, right: MathNode): MathNode {
  return new math.OperatorNode('+', 'add', [left.clone(), right.clone()]);
}

export function multiplyNodes(left: MathNode, right: MathNode): MathNode {
  return new math.OperatorNode('*', 'multiply', [left.clone(), right.clone()]);
}

export function divideNodes(left: MathNode, right: MathNode): MathNode {
  return new math.OperatorNode('/', 'divide', [left.clone(), right.clone()]);
}

export function parenthesis(node: MathNode): MathNode {
  return new math.ParenthesisNode(node.clone());
}

export function constantNode(value: Fraction | number | string): MathNode {
  const frac = typeof value === 'string' ? math.fraction(value) : math.fraction(value as any);
  return new math.ConstantNode(frac);
}

export function nodesEqual(a: MathNode, b: MathNode): boolean {
  return a.toString() === b.toString();
}

export function collectAddends(node: MathNode, options?: { unwrapParenthesis?: boolean }): MathNode[] {
  const unwrap = options?.unwrapParenthesis ?? false;
  if ((node as any).isParenthesisNode) {
    return unwrap ? collectAddends((node as any).content, options) : [node.clone()];
  }

  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    if (opNode.fn === 'add') {
      return opNode.args.flatMap((arg: MathNode) => collectAddends(arg, options));
    }
    if (opNode.fn === 'subtract') {
      const [a, b] = opNode.args as MathNode[];
      return [...collectAddends(a, options), ...collectAddends(negate(b), options)];
    }
  }
  return [node.clone()];
}

export function rebuildSum(terms: MathNode[]): MathNode {
  if (terms.length === 0) {
    return zeroNode();
  }
  let acc = terms[0].clone();
  for (let i = 1; i < terms.length; i += 1) {
    const term = terms[i];
    if ((term as any).isOperatorNode && (term as any).fn === 'unaryMinus') {
      acc = new math.OperatorNode('-', 'subtract', [acc, term.args[0].clone()]);
    } else {
      acc = new math.OperatorNode('+', 'add', [acc, term.clone()]);
    }
  }
  return acc;
}

export function collectFactors(node: MathNode): MathNode[] {
  if ((node as any).isParenthesisNode) {
    return [node.clone()];
  }
  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    if (opNode.fn === 'multiply') {
      return opNode.args.flatMap((arg: MathNode) => collectFactors(arg));
    }
    if (opNode.fn === 'unaryMinus') {
      return [constantNode(-1), ...collectFactors(opNode.args[0])];
    }
  }
  return [node.clone()];
}

export function rebuildProduct(factors: MathNode[]): MathNode {
  if (factors.length === 0) {
    return constantNode(1);
  }
  let acc = factors[0].clone();
  for (let i = 1; i < factors.length; i += 1) {
    const factor = factors[i];
    const next = new math.OperatorNode('*', 'multiply', [acc, factor.clone()]);
    if (typeof (next as any).implicit === 'boolean') {
      (next as any).implicit = true;
    }
    acc = next;
  }
  return acc;
}

export function formatNode(node: MathNode): string {
  return node.toTex();
}
