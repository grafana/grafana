export type NodeType = 'variable' | 'function' | 'class' | 'hook' | 'component';

export interface DotNode {
  file: string;
  name: string;
  type?: NodeType;
  kind: string;
  dependants: DotNode[];
}
