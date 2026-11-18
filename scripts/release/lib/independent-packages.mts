import { createProjectGraphAsync } from '@nx/devkit';

export const INDEPENDENT_TAG = 'release:independent';

export interface IndependentPackage {
  name: string;
  root: string;
  manifestPath: string;
}

interface ProjectNode {
  name: string;
  data: { root: string; tags?: string[] };
}

export function selectIndependentPackages(nodes: Record<string, ProjectNode>): IndependentPackage[] {
  return Object.values(nodes)
    .filter(({ data }) => data.tags?.includes(INDEPENDENT_TAG))
    .map(({ name, data }) => ({ name, root: data.root, manifestPath: `${data.root}/package.json` }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// The packages that are released on their own are the projects Nx knows with the release:independent tag. A project
// name is its package name in this repository, which is also the name the release tag is built from.
export async function getIndependentPackages(): Promise<IndependentPackage[]> {
  const graph = await createProjectGraphAsync({ exitOnError: true });
  return selectIndependentPackages(graph.nodes);
}
