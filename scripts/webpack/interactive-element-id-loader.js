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
        const attrsToCheck = ['data-testid', 'aria-label', 'tabindex', 'href', 'aria-controls', 'label'];
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

        // Subject: Filename (component context)
        const fileName = pathUtils.basename(resourcePath, pathUtils.extname(resourcePath));
        const component = sanitize(fileName);

        const tagName = getTagName(path.node.name);

        // If no identifying content AND no dynamic attributes, fallback to tag name
        // If we have dynamic attributes, we should still include tag name to make the prefix readable
        if (segments.length === 0 && !hasDynamic) {
          segments.push({ type: 'static', value: tagName === 'a' ? 'link' : tagName });
        } else if (hasDynamic) {
          // If we have dynamic, pre-pend tag-name?
          // Let's decide ID structure: scope:component:[tagName]:[segments]...
          // If segments exist, we use them.
        }

        // Deduplicate static segments to avoid redundancy?
        // Hard to deduplicate mixed static/dynamic. We'll leave them as is.

        // Prefix
        let partsExpression = t.stringLiteral(`${scope}:${component}`);

        // If only static segments, we can compute at build time (and dedupe local file counters)
        if (!hasDynamic) {
          const uniqueSegments = [...new Set(segments.map((s) => s.value))];
          // Limit length
          const finalSegments = uniqueSegments.map((s) => (s && s.length > 30 ? s.substring(0, 30) : s || ''));

          let uniqueId = [scope, component, ...finalSegments].join(':');

          const dynamicIdExpr = getAttributeExpression(path, 'id');
          let attributeValue;

          if (dynamicIdExpr) {
            // "uniqueId-" + id
            attributeValue = t.jsxExpressionContainer(
              t.binaryExpression('+', t.stringLiteral(uniqueId + '-'), dynamicIdExpr)
            );
          } else {
            // Counter logic for pure static
            const count = usedIds.get(uniqueId) || 0;
            usedIds.set(uniqueId, count + 1);
            if (count > 0) uniqueId += `-${count}`;
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
          // Construct runtime string concatenation: scope + ":" + component + ":" + (attr || "") ...

          // Start with prefix
          let expr = partsExpression;

          // Include tag name for readability if there are other dynamic parts (to match typical pattern scope:component:button:label)
          // But strict logic: attributes first. If attributes exist, maybe tagname not needed?
          // The previous logic fell back to tagName ONLY if nothing else.
          // If we have segments, checks lengths.

          // Let's iterate segments and chain `+ ":" + (val || "")`
          // We need to implement a "sanitize" replacement at runtime for dynamic values?
          // Or just use raw values? User wants unique. Raw values are unique.
          // We will just use `val` directly.

          // Also include `id` if dynamic
          const dynamicIdExpr = getAttributeExpression(path, 'id');
          if (dynamicIdExpr) {
            segments.unshift({ type: 'dynamic', node: dynamicIdExpr });
          }

          // Append tag name if segments are few? Or just rely on segments.
          // If strict uniqueness needed, segments (like aria-label) are safer.

          segments.forEach((seg) => {
            expr = t.binaryExpression('+', expr, t.stringLiteral(':'));
            if (seg.type === 'static') {
              expr = t.binaryExpression('+', expr, t.stringLiteral(seg.value));
            } else {
              // (seg.node || "")
              const safeExpr = t.logicalExpression('||', seg.node, t.stringLiteral(''));
              expr = t.binaryExpression('+', expr, safeExpr);
            }
          });

          // Check if data-unique-id already exists
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
