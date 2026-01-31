const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const pathUtils = require('path');

function getElementText(path) {
  let text = '';

  // Only traverse children for text content, avoid attributes
  const processNode = (node) => {
    if (!node) return;

    if (node.type === 'JSXText') {
      text += node.value;
    } else if (node.type === 'JSXExpressionContainer' && node.expression.type === 'StringLiteral') {
      text += node.expression.value;
    } else if (node.type === 'JSXElement' && node.children) {
      node.children.forEach(processNode);
    } else if (node.type === 'JSXFragment' && node.children) {
      node.children.forEach(processNode);
    }
  };

  if (path.node.children) {
    path.node.children.forEach(processNode);
  }

  return text.trim();
}

function getScope(resourcePath) {
  const parts = resourcePath.split(pathUtils.sep);

  // Handle features (public/app/features/dashboard -> dashboard)
  const featuresIndex = parts.indexOf('features');
  if (featuresIndex !== -1 && parts[featuresIndex + 1]) {
    return parts[featuresIndex + 1];
  }

  // Handle plugins (public/app/plugins/datasource/loki -> loki)
  const pluginsIndex = parts.indexOf('plugins');
  if (pluginsIndex !== -1) {
    // Look for the plugin name, usually 2 levels deep: plugins/type/name
    if (parts[pluginsIndex + 2]) return parts[pluginsIndex + 2];
    if (parts[pluginsIndex + 1]) return parts[pluginsIndex + 1];
  }

  // Handle packages (packages/grafana-ui -> ui)
  const packagesIndex = parts.indexOf('packages');
  if (packagesIndex !== -1 && parts[packagesIndex + 1]) {
    return parts[packagesIndex + 1].replace(/^grafana-/, '');
  }

  return 'general';
}

function getAttributeExpression(path, attrName) {
  const attributes = path.get('attributes');
  for (const attr of attributes) {
    if (attr.isJSXAttribute() && attr.node.name.name === attrName) {
      if (attr.node.value.type === 'JSXExpressionContainer') {
        return attr.node.value.expression;
      }
    }
  }
  return null;
}

function getAttributeValue(path, attrName) {
  const attributes = path.get('attributes');
  for (const attr of attributes) {
    if (attr.isJSXAttribute() && attr.node.name.name === attrName) {
      if (attr.node.value && attr.node.value.type === 'StringLiteral') {
        return attr.node.value.value;
      }
    }
  }
  return '';
}

function getPlaceholderValue(path) {
  return getAttributeValue(path, 'placeholder');
}

function getTagName(node) {
  if (node.type === 'JSXIdentifier') {
    return node.name;
  }
  if (node.type === 'JSXMemberExpression') {
    return `${getTagName(node.object)}.${getTagName(node.property)}`;
  }
  return '';
}

function isInteractive(path) {
  const tagName = getTagName(path.node.name);
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'option', 'details', 'summary'];
  if (interactiveTags.includes(tagName)) return true;

  const attributes = path.get('attributes');
  for (const attr of attributes) {
    if (attr.isJSXAttribute() && attr.node.name.name && attr.node.name.name.startsWith('on')) {
      return true; // Has event handler like onClick
    }
  }

  return false;
}

function sanitize(str) {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAttributeNode(path, attrName) {
  const attributes = path.get('attributes');
  for (const attr of attributes) {
    if (attr.isJSXAttribute() && attr.node.name && attr.node.name.name === attrName) {
      if (attr.node.value && attr.node.value.type === 'StringLiteral') {
        return { type: 'static', value: attr.node.value.value };
      }
      if (attr.node.value && attr.node.value.type === 'JSXExpressionContainer') {
        return { type: 'dynamic', node: attr.node.value.expression };
      }
    }
  }
  return null;
}

function getParentContext(path) {
  const context = [];
  // Start from parent of the JSXElement (path is JSXOpeningElement, parent is JSXElement)
  let current = path.parentPath.parentPath;

  // Traverse up but limit to prevent perf issues
  let attempts = 0;
  while (current && attempts < 5) {
    if (current.isJSXElement()) {
      const opening = current.get('openingElement');
      const testId = getAttributeValue(opening, 'data-testid');
      const label = getAttributeValue(opening, 'aria-label');
      const name = getAttributeValue(opening, 'name');
      const title = getAttributeValue(opening, 'title');

      // Use the closest significant parent identifier
      const significant = testId || label || name || title;
      if (significant) {
        const val = sanitize(significant);
        if (val) context.unshift(val);
        // If we found a good identifier, we might stop or continue?
        // Let's capture up to 2 identifying parents.
        if (context.length >= 2) break;
      }
    }
    current = current.parentPath;
    attempts++;
  }
  return context;
}

function getChildContext(path) {
  const context = [];
  const elementPath = path.parentPath;

  // Shallow traversal for significant specific children (like Icons or text placeholders)
  elementPath.traverse({
    JSXOpeningElement(childOpen) {
      // Skip identifying self again
      if (childOpen.node === path.node) return;

      // Look for specific attributes that give visual cues
      const icon = getAttributeValue(childOpen, 'icon'); // e.g. <Icon name="trash" />
      const name = getAttributeValue(childOpen, 'name'); // e.g. <Icon name="trash" />

      if (name) context.push(sanitize(name));
      if (icon) context.push(sanitize(icon));
    },
    // Don't go deep
    JSXElement(path) {
      path.skip();
    },
  });
  return [...new Set(context)];
}

function getDirectoryContext(resourcePath, scope) {
  const parts = pathUtils.dirname(resourcePath).split(pathUtils.sep);

  // Find where the scope starts in the path
  const scopeIndex = parts.lastIndexOf(scope);

  // If found, take everything after it
  if (scopeIndex !== -1 && scopeIndex < parts.length - 1) {
    // e.g. features/alerting/unified/components -> ['unified', 'components']
    return parts
      .slice(scopeIndex + 1)
      .map((p) => sanitize(p))
      .filter((p) => p.length > 0);
  }

  // Fallback: If scope not found in path (e.g. package name alias logic), use last 2 dirs?
  // Or just look for known roots
  let rootIndex = -1;
  ['features', 'plugins', 'packages'].forEach((root) => {
    const idx = parts.lastIndexOf(root);
    if (idx > rootIndex) rootIndex = idx;
  });

  if (rootIndex !== -1) {
    // features/foo/bar/baz -> foo/bar/baz. Scope is foo.
    // We want bar/baz.

    // This is tricky because getScope handles identifying 'foo'.
    // Let's assume the part AFTER root is the scope, and we want what follows.
    if (parts.length > rootIndex + 2) {
      return parts.slice(rootIndex + 2).map((p) => sanitize(p));
    }
  }

  return [];
}

module.exports = function (source) {
  const options = this.getOptions();
  const resourcePath = pathUtils.relative(this.rootContext || process.cwd(), this.resourcePath);

  // Skip node_modules
  if (resourcePath.includes('node_modules')) {
    return source;
  }

  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'classProperties', 'decorators-legacy'],
  });

  let modified = false;
  const usedIds = new Map();

  traverse(ast, {
    JSXOpeningElement(path) {
      if (isInteractive(path)) {
        // Gather attributes as requested
        // Added 'key' to support uniqueness in lists (.map loops)
        // Added 'title' and 'name' for better context
        const attrsToCheck = [
          'data-testid',
          'aria-label',
          'tabindex',
          'href',
          'aria-controls',
          'label',
          'key',
          'title',
          'name',
          'placeholder',
          'alt',
          'id',
          'value',
          'type',
          'role',
          'data-label',
        ];
        const segments = [];

        let hasDynamic = false;

        for (const attrName of attrsToCheck) {
          const attrNode = getAttributeNode(path, attrName);
          if (attrNode) {
            if (attrNode.type === 'static') {
              // Static value is usually preferred over dynamic equivalent
              const val = sanitize(attrNode.value);
              if (val) segments.push({ type: 'static', value: val });
            } else if (attrNode.type === 'dynamic') {
              // Special case: if 'id' is dynamic, we handle it separately to allow fallback to tag name
              // and cleaner appending logic in the static path if possible.
              if (attrName === 'id') continue;

              hasDynamic = true;
              // For dynamic, we push the expression
              segments.push({ type: 'dynamic', node: attrNode.node });
            }
          }
        }

        const innerText = getElementText(path.parentPath);
        if (innerText) {
          const val = sanitize(innerText);
          if (val) segments.push({ type: 'static', value: val });
        }

        // Scope: Feature or Package
        const scope = getScope(resourcePath);

        // Context: File System Path
        const pathContext = getDirectoryContext(resourcePath, scope);

        // Subject: Filename (component context)
        const fileName = pathUtils.basename(resourcePath, pathUtils.extname(resourcePath));
        const component = sanitize(fileName);

        // Context: Parents
        const parentContext = getParentContext(path);

        // Context: Children
        const childContext = getChildContext(path);

        const tagName = getTagName(path.node.name);

        // If we found nothing identifying in local attributes, dynamic attributes, or child context, fallback to tag name
        if (segments.length === 0 && !hasDynamic && childContext.length === 0) {
          segments.push({ type: 'static', value: tagName === 'a' ? 'link' : tagName });
        }

        // Add child contexts as static segments
        childContext.forEach((c) => segments.push({ type: 'static', value: c }));

        // Assembly: [Scope, ...PathContext, Component, ...ParentContext, ...Segments (local + child)]
        // Since Scope, Component, and ParentContext are all static strings available now, we can merge them into prefix

        const staticPrefixList = [scope, ...pathContext, component, ...parentContext];
        const staticPrefixString = staticPrefixList.join(':');

        let partsExpression = t.stringLiteral(staticPrefixString);

        // If only static segments, we can compute at build time (and dedupe local file counters)
        if (!hasDynamic) {
          const uniqueSegments = segments.map((s) => s.value);
          // Deduplicate local segments only?
          const distinctSegments = [...new Set(uniqueSegments)];

          // Limit length
          const finalSegments = distinctSegments.map((s) => (s && s.length > 30 ? s.substring(0, 30) : s || ''));

          // Full ID
          let uniqueId = [staticPrefixString, ...finalSegments].join(':');

          const dynamicIdExpr = getAttributeExpression(path, 'id');
          let attributeValue;

          // Counter logic for pure static ID to ensure local uniqueness
          const count = usedIds.get(uniqueId) || 0;
          usedIds.set(uniqueId, count + 1);
          if (count > 0) uniqueId += `-${count}`;

          if (dynamicIdExpr) {
            // "uniqueId-" + id
            attributeValue = t.jsxExpressionContainer(
              t.binaryExpression('+', t.stringLiteral(uniqueId + '-'), dynamicIdExpr)
            );
          } else {
            attributeValue = t.stringLiteral(uniqueId);
          }

          // Check if data-unique-id already exists
          const existingId = getAttributeValue(path, 'data-unique-id');
          if (!existingId) {
            path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-unique-id'), attributeValue));
            modified = true;
          }
        } else {
          // Mixed static and dynamic.
          let expr = partsExpression;

          // Also include `id` if dynamic
          const dynamicIdExpr = getAttributeExpression(path, 'id');
          if (dynamicIdExpr) {
            segments.unshift({ type: 'dynamic', node: dynamicIdExpr });
          }

          segments.forEach((seg) => {
            expr = t.binaryExpression('+', expr, t.stringLiteral(':'));
            if (seg.type === 'static') {
              expr = t.binaryExpression('+', expr, t.stringLiteral(seg.value));
            } else {
              // Check if safe (string)
              const safeExpr = t.logicalExpression('||', seg.node, t.stringLiteral(''));
              expr = t.binaryExpression('+', expr, safeExpr);
            }
          });

          const existingId = getAttributeValue(path, 'data-unique-id');
          if (!existingId) {
            path.node.attributes.push(
              t.jsxAttribute(t.jsxIdentifier('data-unique-id'), t.jsxExpressionContainer(expr))
            );
            modified = true;
          }
        }
      }
    },
  });

  if (modified) {
    const { code } = generate(ast, { retainLines: true }, source);
    return code;
  }

  return source;
};
