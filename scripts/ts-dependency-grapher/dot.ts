import type { DotNode } from './types.ts';

export function generateHTMLStringLabel(node: DotNode) {
  return `<<table border="0">
			<tr><td><b>${node.name}</b></td></tr>
      <tr><td>(${node.type})</td></tr>
		</table>>`;
}

export function generateNodeColor(node: DotNode) {
  if (node.type === 'hook') {
    return 'aliceblue';
  }

  if (node.type === 'component') {
    return 'cornsilk';
  }

  if (node.type === 'variable') {
    return 'bisque';
  }

  if (node.type === 'class') {
    return 'pink';
  }

  return '';
}

export function generateDotStart({
  outputDPI = 96,
  outputHeight = 1080,
  outputWidth = 1920,
}: {
  outputDPI?: number;
  outputHeight?: number;
  outputWidth?: number;
}) {
  let output = '';
  const width = outputWidth / outputDPI;
  const height = outputHeight / outputDPI;
  output += `digraph graphname {\n`;
  output += `\trankdir="LR"\n`;
  output += `\tgraph [size="${width},${height}!" dpi=${outputDPI}];\n`;

  return output;
}

export function generateDotEnd() {
  return `}\n`;
}

export function generateDotNode(node: DotNode) {
  const label = generateHTMLStringLabel(node);
  const color = generateNodeColor(node);
  return `\t${node.name} [style="filled" fillcolor="${color}" shape=rect label=${label} URL="file://${node.file}" tooltip="${node.file}"]\n`;
}

export function generateDotEdge(parent: DotNode, dependant: DotNode) {
  return `${parent.name} -> ${dependant.name}`;
}

export function generateDotContent({
  level = 0,
  output,
  outputDPI,
  outputHeight,
  outputWidth,
  parent,
  seen,
}: {
  level?: number;
  output: string;
  outputDPI?: number;
  outputHeight?: number;
  outputWidth?: number;
  parent: DotNode;
  seen: Set<string>;
}) {
  if (level === 0) {
    output += generateDotStart({ outputDPI, outputHeight, outputWidth });
  }

  output += generateDotNode(parent);
  for (const dependant of parent.dependants) {
    const edge = generateDotEdge(parent, dependant);
    if (seen.has(edge)) {
      continue;
    }
    seen.add(edge);
    const depOutput = generateDotContent({
      output,
      outputDPI,
      outputHeight,
      outputWidth,
      parent: dependant,
      seen,
      level: level + 1,
    });
    output = depOutput;
    output += `${edge} [dir=back]\n`;
  }

  if (level === 0) {
    output += generateDotEnd();
  }

  return output;
}
