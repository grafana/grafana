import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

import { enhanceStatsViewer } from './statsViewerEnhancements.ts';

const viewer = `
class Store {
  get searchQueryRegexp(){const e=this.searchQuery.trim();if(!e)return null;try{return new RegExp(e,"iu")}catch(t){return null}}
  get foundModulesSize(){return this.foundModules.reduce(((e,t)=>e+t[this.activeSize]),0)}
}
function zn(nodes, visit) {
  for (const node of nodes || []) {
    visit(node);
    zn(node.groups, visit);
  }
}
class SearchStore extends Store {
  get isSearching(){return !!this.searchQueryRegexp}
  get foundModulesByChunk(){if(!this.isSearching)return[];const e=this.searchQueryRegexp;return this.visibleChunks.map((t=>{let n=[];zn(t.groups,(t=>{let i=0;if(e.test(t.label)?i+=3:t.path&&e.test(t.path)&&i++,!i)return;t.groups||(i+=1);(n[i-1]=n[i-1]||[]).push(t)}));const{activeSize:i}=this;return n=n.filter(Boolean).reverse(),n.forEach((e=>e.sort(((e,t)=>t[i]-e[i])))),{chunk:t,modules:[].concat(...n)}})).filter((e=>e.modules.length>0)).sort(((e,t)=>e.modules.length-t.modules.length))}
  get foundModules(){return this.foundModulesByChunk.flatMap(result => result.modules)}
}
class View {
  get highlightedModules(){return new Set(a$1.foundModules)}
}
class Title {
  constructor(props) { this.props = props; }
  get titleHtml(){let e;const{module:t}=this.props,n=t.path||t.label,i=this.props.highlightedText;if(i){const t=i instanceof RegExp?new RegExp(i.source,"igu"):new RegExp(i,"iu");let r,o;do{o=r,r=t.exec(n)}while(r);o&&(e=n.slice(0,o.index)+"<strong>"+o[0]+"</strong>"+n.slice(o.index+o[0].length))}return e||n}
}
const a$1 = Object.assign(new Store(), state);
({ store: a$1, view: new View() });
`;

interface Node {
  parsedSize: number;
  gzipSize: number;
  groups?: Node[];
}

function setup(foundModules: Node[], visibleChunks: Node[], activeSize = 'parsedSize') {
  return runInNewContext(enhanceStatsViewer(viewer), {
    state: { foundModules, visibleChunks, activeSize },
  }) as {
    store: { foundModulesSize: number; foundModules: Node[] };
    view: { highlightedModules: Set<Node> };
  };
}

const first: Node = { parsedSize: 20, gzipSize: 5 };
const second: Node = { parsedSize: 30, gzipSize: 7 };
const parent: Node = { parsedSize: 52, gzipSize: 10, groups: [first, second] };
const chunk: Node = { parsedSize: 60, gzipSize: 15, groups: [parent] };

describe('enhanceStatsViewer', () => {
  it('counts a matched parent once while keeping its children highlighted', () => {
    const { store, view } = setup([parent, first, second], [chunk]);
    assert.equal(store.foundModulesSize, 52);
    assert.ok(view.highlightedModules.has(first));
    assert.ok(view.highlightedModules.has(second));
    assert.ok(view.highlightedModules.has(chunk));
    assert.equal(store.foundModules.length, 3);
  });

  it('highlights a chunk when all leaves match without counting chunk overhead', () => {
    const { store, view } = setup([first, second], [chunk]);
    assert.equal(store.foundModulesSize, 50);
    assert.ok(view.highlightedModules.has(chunk));
  });

  it('does not highlight a partially selected chunk', () => {
    const { store, view } = setup([first], [chunk]);
    assert.equal(store.foundModulesSize, 20);
    assert.ok(view.highlightedModules.has(first));
    assert.equal(view.highlightedModules.has(chunk), false);
  });

  it('uses the active size metric and the matched parent size', () => {
    const { store } = setup([parent, first, second], [chunk], 'gzipSize');
    assert.equal(store.foundModulesSize, 10);
  });

  it('limits totals and whole-chunk highlighting to visible chunks', () => {
    const hiddenChunk: Node = { parsedSize: 30, gzipSize: 7, groups: [second] };
    const { store, view } = setup([first], [{ parsedSize: 20, gzipSize: 5, groups: [first] }]);
    assert.equal(store.foundModulesSize, 20);
    assert.equal(view.highlightedModules.has(hiddenChunk), false);
  });

  it('returns zero and no highlights for an empty selection', () => {
    const emptyChunk: Node = { parsedSize: 1, gzipSize: 1, groups: [] };
    const { store, view } = setup([], [chunk, emptyChunk]);
    assert.equal(store.foundModulesSize, 0);
    assert.equal(view.highlightedModules.size, 0);
  });

  it('can process an already enhanced report again without changes', () => {
    const enhanced = enhanceStatsViewer(viewer);
    assert.equal(enhanceStatsViewer(enhanced), enhanced);
  });

  for (const pattern of ['slate', 'slate|', '(?=😀)|slate', 'slate|$']) {
    it(`selects only nonempty label or path matches for ${pattern}`, () => {
      const modules = [
        { label: 'slate', path: './slate', parsedSize: 20 },
        { label: 'index.js', path: './😀/slate/index.js', parsedSize: 30 },
        { label: 'react', path: './react', parsedSize: 40 },
      ];
      const result = runInNewContext(
        enhanceStatsViewer(viewer) +
          `
Object.setPrototypeOf(a$1, SearchStore.prototype);
({ paths: a$1.foundModules.map(n => n.path).sort().join(','),
   size: a$1.foundModulesSize, highlighted: new View().highlightedModules.size });`,
        { state: { searchQuery: pattern, activeSize: 'parsedSize', visibleChunks: [{ groups: modules }] } },
        { timeout: 1000 }
      );
      assert.equal(result.paths, './slate,./😀/slate/index.js');
      assert.equal(result.size, 50);
      assert.equal(result.highlighted, 2);
    });
  }

  for (const pattern of ['^', '$', '(?:)', '(?=slate)', '|', '|slate', 'slate(', '']) {
    it(`does not select or count empty matches for ${JSON.stringify(pattern)}`, () => {
      const result = runInNewContext(
        enhanceStatsViewer(viewer) +
          `
Object.setPrototypeOf(a$1, SearchStore.prototype);
({ count: a$1.foundModules.length, size: a$1.foundModulesSize, highlighted: new View().highlightedModules.size });`,
        {
          state: {
            searchQuery: pattern,
            activeSize: 'parsedSize',
            visibleChunks: [{ groups: [{ label: 'slate', path: './😀/slate', parsedSize: 20 }] }],
          },
        },
        { timeout: 1000 }
      );
      assert.equal(result.count, 0);
      assert.equal(result.size, 0);
      assert.equal(result.highlighted, 0);
    });
  }

  it('upgrades reports with the previous freeze fix but no nonempty-match guard', () => {
    const enhanced = enhanceStatsViewer(viewer);
    const getter = /get foundModulesByChunk\(\)\{[\s\S]*?(?=get foundModules\(\))/;
    const legacy = enhanced.replace(getter, () => viewer.match(getter)![0]);
    assert.equal(enhanceStatsViewer(legacy), enhanced);
  });

  it('rejects a changed search getter', () => {
    assert.throws(
      () => enhanceStatsViewer(viewer.replace('e.test(t.path)', 'e.exec(t.path)')),
      /search match calls changed/
    );
  });

  for (const pattern of ['slate|', '(?=😀)|slate']) {
    it(`advances past empty matches and highlights text for ${pattern}`, () => {
      const title = runInNewContext(
        enhanceStatsViewer(viewer) +
          '\nnew Title({module: {path: text}, highlightedText: new RegExp(pattern, "iu")}).titleHtml',
        { state: {}, text: '😀/slate/slate', pattern },
        { timeout: 1000 }
      );
      assert.equal(title, '😀/slate/<strong>slate</strong>');
    });
  }

  for (const pattern of ['^', '$', '(?:)', '(?=slate)', '|slate', '(?=slate)|slate']) {
    it(`finishes without empty highlight markup for ${pattern}`, () => {
      const title = runInNewContext(
        enhanceStatsViewer(viewer) +
          '\nnew Title({module: {path: text}, highlightedText: new RegExp(pattern, "iu")}).titleHtml',
        { state: {}, text: '😀/slate', pattern },
        { timeout: 1000 }
      );
      assert.equal(title, '😀/slate');
    });
  }

  it('preserves the last nonempty match for an ordinary regexp', () => {
    const title = runInNewContext(
      enhanceStatsViewer(viewer) + '\nnew Title({module: {path: "slate/slate"}, highlightedText: /slate/iu}).titleHtml',
      { state: {} },
      { timeout: 1000 }
    );
    assert.equal(title, 'slate/<strong>slate</strong>');
  });

  it('terminates for the non-global string highlight branch', () => {
    const title = runInNewContext(
      enhanceStatsViewer(viewer) + '\nnew Title({module: {path: "slate/slate"}, highlightedText: "slate"}).titleHtml',
      { state: {} },
      { timeout: 1000 }
    );
    assert.equal(title, '<strong>slate</strong>/slate');
  });

  it('retains the viewer guard for incomplete regexp syntax', () => {
    const result = runInNewContext(enhanceStatsViewer(viewer) + '\na$1.searchQueryRegexp', {
      state: { searchQuery: 'slate(' },
    });
    assert.equal(result, null);
  });

  it('reproduces the original empty-match hang within a bounded VM timeout', () => {
    assert.throws(
      () =>
        runInNewContext(
          viewer + '\nnew Title({module: {path: "slate"}, highlightedText: /slate|/iu}).titleHtml',
          { state: {} },
          { timeout: 100 }
        ),
      /Script execution timed out/
    );
  });

  it('upgrades a report that already has the selection enhancements', () => {
    const enhanced = enhanceStatsViewer(viewer);
    const start = enhanced.indexOf('/* grafana-stats-viewer-search-v1 */');
    const end = enhanced.indexOf('o&&', start);
    const legacy = enhanced.slice(0, start) + 'let r,o;do{o=r,r=t.exec(n)}while(r);' + enhanced.slice(end);
    assert.equal(enhanceStatsViewer(legacy), enhanced);
  });

  it('rejects a viewer with a changed title highlight loop', () => {
    assert.throws(
      () => enhanceStatsViewer(viewer.replace('while(r);', 'while(false);')),
      /title highlight loop changed/
    );
  });

  it('rejects missing or duplicated viewer getters', () => {
    assert.throws(() => enhanceStatsViewer('<html></html>'), /viewer getters changed/);
    assert.throws(() => enhanceStatsViewer(viewer + viewer), /viewer getters changed/);
  });
});
