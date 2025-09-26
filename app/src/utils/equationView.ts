import type { MathNode } from '../domain/math';
import { getNodeId, isConstant } from '../domain/nodeUtils';

export interface FactorView {
  id: string;
  node: MathNode;
  latex: string;
  isConstant: boolean;
  isGroup: boolean;
  parentProductId: string;
}

export interface ProductView {
  id: string;
  node: MathNode;
  latex: string;
  factors: FactorView[];
}

export interface AddendView {
  id: string;
  node: MathNode;
  latex: string;
  sign: 1 | -1;
  isConstant: boolean;
  isGroup: boolean;
  product?: ProductView;
}

function collectAddendNodes(node: MathNode, sign: 1 | -1, bag: AddendView[]): void {
  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    if (opNode.fn === 'add') {
      opNode.args.forEach((arg: MathNode) => collectAddendNodes(arg, sign, bag));
      return;
    }
    if (opNode.fn === 'subtract') {
      const [a, b] = opNode.args as MathNode[];
      collectAddendNodes(a, sign, bag);
      collectAddendNodes(b, (sign * -1) as 1 | -1, bag);
      return;
    }
  }
  bag.push(createAddend(node, sign));
}

function createAddend(node: MathNode, sign: 1 | -1): AddendView {
  const id = getNodeId(node) ?? node.toString();
  const latex = node.toTex();
  const isGroup = Boolean((node as any).isParenthesisNode);
  const product = buildProduct(node);
  return {
    id,
    node,
    latex,
    sign,
    isConstant: isConstant(node),
    isGroup,
    product,
  };
}

function buildProduct(node: MathNode): ProductView | undefined {
  if (!((node as any).isOperatorNode)) return undefined;
  const opNode = node as any;
  if (opNode.fn !== 'multiply') return undefined;
  const factors = extractFactorNodes(node).map((factor) => ({
    id: getNodeId(factor) ?? factor.toString(),
    node: factor,
    latex: factor.toTex(),
    isConstant: isConstant(factor),
    isGroup: Boolean((factor as any).isParenthesisNode),
    parentProductId: getNodeId(node) ?? node.toString(),
  }));
  if (factors.length <= 1) return undefined;
  return {
    id: getNodeId(node) ?? node.toString(),
    node,
    latex: node.toTex(),
    factors,
  };
}

function extractFactorNodes(node: MathNode): MathNode[] {
  if ((node as any).isOperatorNode) {
    const opNode = node as any;
    if (opNode.fn === 'multiply') {
      return opNode.args.flatMap((arg: MathNode) => extractFactorNodes(arg));
    }
  }
  return [node];
}

export function buildAddendViews(root: MathNode): AddendView[] {
  const addends: AddendView[] = [];
  collectAddendNodes(root, 1, addends);
  return addends;
}
