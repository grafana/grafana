import chalk from 'chalk';
import {
  type ClassDeclaration,
  type FunctionDeclaration,
  Node,
  type SourceFile,
  SyntaxKind,
  type VariableDeclaration,
} from 'ts-morph';

import type { DotNode, NodeType } from './types.ts';

const hookNameRegex = /^use[A-Z]/;
const classNameRegex = /^[A-Z]/;

export function getFunction(source: SourceFile, name: string): FunctionDeclaration | undefined {
  const fn = source.getFunction(name);

  return fn;
}

export function getVariable(source: SourceFile, name: string): VariableDeclaration | undefined {
  const v = source.getVariableDeclaration(name);

  return v;
}

export function getClass(source: SourceFile, name: string): ClassDeclaration | undefined {
  const v = source.getClass(name);

  return v;
}

export function getFile(node: Node): string {
  return node.getSourceFile().getFilePath();
}

export function getName(node: Node): string {
  if (Node.isVariableDeclaration(node)) {
    return node.getName();
  }

  if (Node.isVariableStatement(node)) {
    return node.getDeclarations()[0]?.getName();
  }

  if (Node.isFunctionDeclaration(node)) {
    return node.getNameOrThrow();
  }

  if (Node.isMethodDeclaration(node)) {
    return node.getName();
  }

  if (Node.isArrowFunction(node)) {
    const parent = node.getParent();

    if (Node.isVariableDeclaration(parent)) {
      return parent.getName();
    }

    if (Node.isPropertyAssignment(parent)) {
      return parent.getName();
    }

    if (Node.isPropertyDeclaration(parent)) {
      return parent.getName();
    }

    if (Node.isCallExpression(parent)) {
      const expression = parent.getExpression();

      if (Node.isIdentifier(expression)) {
        return expression.getText();
      }

      if (Node.isPropertyAccessExpression(expression)) {
        return expression.getName();
      }
    }

    return 'unknown';
  }

  if (Node.isClassDeclaration(node)) {
    return node.getNameOrThrow();
  }

  return 'unknown';
}

function hasJsxTypeReturns(node: Node): boolean {
  if (!Node.isFunctionDeclaration(node) && !Node.isMethodDeclaration(node) && !Node.isArrowFunction(node)) {
    return false;
  }

  const returnType = node.getReturnType();
  const returnTypeText = returnType.getText();

  // Check for common React return types
  const reactReturnTypes = [
    'JSX.Element',
    'ReactElement',
    'ReactNode',
    'React.ReactElement',
    'React.ReactNode',
    'Element',
  ];

  return reactReturnTypes.some((r) => returnTypeText.includes(r));
}

function hasJsxReturn(node: Node): boolean {
  const jsxElements = node.getDescendantsOfKind(SyntaxKind.JsxElement);
  const jsxSelfClosing = node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  const jsxFragment = node.getDescendantsOfKind(SyntaxKind.JsxFragment);

  if (jsxElements.length > 0 || jsxSelfClosing.length > 0 || jsxFragment.length > 0) {
    return true;
  }

  return hasJsxTypeReturns(node);
}

function getClassType(node: Node, name: string): NodeType | undefined {
  if (classNameRegex.test(name) && hasJsxReturn(node)) {
    return 'component';
  }

  return 'class';
}

function getFunctionType(node: Node, name: string, defaultType: NodeType = 'function'): NodeType | undefined {
  if (hookNameRegex.test(name)) {
    return 'hook';
  }

  if (classNameRegex.test(name) && hasJsxReturn(node)) {
    return 'component';
  }

  return defaultType;
}

export function getType(node: Node, name: string): NodeType | undefined {
  if (Node.isClassDeclaration(node)) {
    return getClassType(node, name);
  }

  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node) || Node.isArrowFunction(node)) {
    return getFunctionType(node, name);
  }

  if (Node.isVariableDeclaration(node)) {
    const arrowFunction = node.getInitializerIfKind(SyntaxKind.ArrowFunction);
    if (arrowFunction) {
      return getFunctionType(arrowFunction, name);
    }

    const functionDeclaration = node.getInitializerIfKind(SyntaxKind.FunctionDeclaration);
    if (functionDeclaration) {
      return getFunctionType(functionDeclaration, name);
    }

    const callExpression = node.getInitializerIfKind(SyntaxKind.CallExpression);
    if (callExpression) {
      return getFunctionType(callExpression, name, 'variable');
    }

    const classDeclaration = node.getInitializerIfKind(SyntaxKind.ClassDeclaration);
    if (classDeclaration) {
      return getClassType(classDeclaration, name);
    }

    return 'variable';
  }
}

function equals(first: DotNode, second: DotNode) {
  return first.name === second.name && first.file === second.file && first.kind === second.kind;
}

function getTopMostAncestor(ref: Node) {
  const ancestor = ref.getFirstAncestor(
    (node) =>
      node.getKind() === SyntaxKind.FunctionDeclaration ||
      node.getKind() === SyntaxKind.MethodDeclaration ||
      node.getKind() === SyntaxKind.VariableDeclaration ||
      node.getKind() === SyntaxKind.ClassDeclaration
  );

  if (!ancestor) {
    return ref;
  }

  return getTopMostAncestor(ancestor);
}

function shouldFilterFile(file: string) {
  return (
    file.includes('.test.') ||
    file.includes('.spec.') ||
    file.includes('/mocks/') ||
    file.includes('/node_modules/') ||
    file.includes('/dist/') ||
    file.includes('/build/') ||
    file.includes('/out/')
  );
}

export function traverse({
  dotNode,
  tsObj,
  level = 0,
  maxLevel = 0,
  debug = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tsObj: any;
  dotNode: DotNode;
  level?: number;
  maxLevel?: number;
  debug?: boolean;
}) {
  if (!tsObj?.findReferencesAsNodes) {
    return;
  }

  const refs = tsObj?.findReferencesAsNodes() || [];
  if (debug) {
    console.log(`searching for ${chalk.green(dotNode.name)}`);
  }

  for (const ref of refs) {
    const ancestor = getTopMostAncestor(ref);
    if (!ancestor) {
      continue;
    }

    const file = getFile(ancestor);
    if (shouldFilterFile(file)) {
      continue;
    }

    const name = getName(ancestor);
    if (name === 'unknown') {
      continue;
    }

    const type = getType(ancestor, name);
    const kind = ancestor.getKindName();
    const dependant: DotNode = { dependants: [], file, name, type, kind };

    if (equals(dependant, dotNode)) {
      continue;
    }

    if (dotNode.dependants.find((d) => equals(d, dependant))) {
      continue;
    }

    dotNode.dependants.push(dependant);
    if (debug) {
      console.log(
        `${chalk.yellow(dependant.name)} references ${chalk.yellow(dotNode.name)} at level ${chalk.green(level)} of ${chalk.green(maxLevel)} (${chalk.green(dependant.file)})`
      );
    }
    if (level < maxLevel) {
      traverse({ dotNode: dependant, tsObj: ancestor, level: level + 1, maxLevel, debug });
    }
  }
}
