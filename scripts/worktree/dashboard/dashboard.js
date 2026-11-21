const REFRESH_MS = 5000;

function element(tag, { className, text, attributes } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  for (const [name, value] of Object.entries(attributes ?? {})) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

function statusDot(up, label) {
  return element('span', { className: `dot ${up ? 'up' : 'down'}`, attributes: { title: label } });
}

function details(worktree) {
  if (worktree.description) {
    return element('p', { text: worktree.description });
  }
  if (worktree.commits.length) {
    return element(
      'ul',
      {},
      worktree.commits.map((subject) => element('li', { text: subject }))
    );
  }
  return element('p', { className: 'muted', text: 'No commits ahead of main.' });
}

function card(worktree) {
  return element(
    'a',
    { className: 'card', attributes: { href: `http://${encodeURIComponent(worktree.name)}.localhost` } },
    [
      element('h2', {}, [
        statusDot(worktree.up, worktree.up ? 'frontend running' : 'frontend not running'),
        worktree.name,
      ]),
      element('p', { className: 'muted', text: worktree.branch }),
      details(worktree),
    ]
  );
}

function render(data) {
  const { backend } = data;
  document
    .getElementById('backend')
    .replaceChildren(
      statusDot(backend.up, backend.up ? 'backend running' : 'backend not running'),
      `Backend (${backend.name}) on localhost:${backend.port} is ${backend.up ? 'running' : 'not running'}. `,
      element('a', { text: 'Traefik dashboard', attributes: { href: 'http://traefik.localhost' } })
    );
  document
    .getElementById('grid')
    .replaceChildren(
      ...(data.worktrees.length
        ? data.worktrees.map(card)
        : [element('p', { className: 'muted', text: 'No worktrees registered. Run mise run worktree:frontend.' })])
    );
}

async function refresh() {
  try {
    const response = await fetch('/api/worktrees', { cache: 'no-store' });
    render(await response.json());
  } catch {
    document.getElementById('backend').textContent = 'Dashboard server is not reachable. Retrying…';
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
