/**
 * Converts jest-canvas-mock CanvasRenderingContext2DEvent arrays (as stored in Jest
 * snapshot `.snap` files — typically without `transform`) into readable
 * `CanvasRenderingContext2D` call sequences for debugging snapshot diffs.
 */

/** @typedef {{ type: string; props?: Record<string, unknown> }} CanvasLikeEvent */

/**
 * Jest pretty-prints snapshot JSON with trailing commas, which `JSON.parse` rejects.
 * @param {string} text
 */
export function parseSnapshotJson(text) {
  const withoutTrailingCommas = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

/**
 * @param {string} content - full contents of a `.snap` file
 * @returns {Map<string, unknown>}
 */
export function parseJestSnapshot(content) {
  const out = new Map();
  const re = /^exports\[`((?:[^`\\]|\\.)*)`\]\s*=\s*`([\s\S]*?)`;/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const rawName = m[1];
    const name = rawName.replace(/\\(.)/g, '$1');
    const body = m[2];
    try {
      out.set(name, parseSnapshotJson(body));
    } catch (e) {
      out.set(name, {
        __parseError: true,
        message: /** @type {Error} */ (e).message,
        preview: body.slice(0, 240),
      });
    }
  }
  return out;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function lit(v) {
  return JSON.stringify(v);
}

/**
 * @param {CanvasLikeEvent} ev
 * @param {string} ctx
 * @param {string[]} lines
 */
function emitPathBuilding(ev, ctx, lines) {
  const { type, props = {} } = ev;
  switch (type) {
    case 'beginPath':
      lines.push(`${ctx}.beginPath();`);
      break;
    case 'closePath':
      lines.push(`${ctx}.closePath();`);
      break;
    case 'moveTo':
      lines.push(`${ctx}.moveTo(${lit(props.x)}, ${lit(props.y)});`);
      break;
    case 'lineTo':
      lines.push(`${ctx}.lineTo(${lit(props.x)}, ${lit(props.y)});`);
      break;
    case 'rect':
      lines.push(
        `${ctx}.rect(${lit(props.x)}, ${lit(props.y)}, ${lit(props.width)}, ${lit(props.height)});`
      );
      break;
    case 'arc':
      lines.push(
        `${ctx}.arc(${lit(props.x)}, ${lit(props.y)}, ${lit(props.radius)}, ${lit(props.startAngle)}, ${lit(
          props.endAngle
        )}, ${lit(props.anticlockwise)});`
      );
      break;
    case 'arcTo':
      lines.push(
        `${ctx}.arcTo(${lit(props.cpx1)}, ${lit(props.cpy1)}, ${lit(props.cpx2)}, ${lit(props.cpy2)}, ${lit(
          props.radius
        )});`
      );
      break;
    case 'ellipse':
      lines.push(
        `${ctx}.ellipse(${lit(props.x)}, ${lit(props.y)}, ${lit(props.radiusX)}, ${lit(
          props.radiusY
        )}, ${lit(props.rotation)}, ${lit(props.startAngle)}, ${lit(props.endAngle)}, ${lit(
          props.anticlockwise
        )});`
      );
      break;
    case 'bezierCurveTo':
      lines.push(
        `${ctx}.bezierCurveTo(${lit(props.cpx1)}, ${lit(props.cpy1)}, ${lit(props.cpx2)}, ${lit(
          props.cpy2
        )}, ${lit(props.x)}, ${lit(props.y)});`
      );
      break;
    case 'quadraticCurveTo':
      lines.push(
        `${ctx}.quadraticCurveTo(${lit(props.cpx)}, ${lit(props.cpy)}, ${lit(props.x)}, ${lit(props.y)});`
      );
      break;
    case 'clip': {
      const p = /** @type {any} */ (props).path;
      const fillRule = /** @type {string} */ (props.fillRule ?? 'nonzero');
      lines.push(`${ctx}.beginPath();`);
      if (Array.isArray(p)) {
        for (const seg of p) {
          emitPathBuilding(/** @type {CanvasLikeEvent} */ (seg), ctx, lines);
        }
      }
      lines.push(`${ctx}.clip(${lit(fillRule)});`);
      break;
    }
    default:
      lines.push(`// unhandled path segment: ${lit(ev)}`);
  }
}

/**
 * @param {CanvasLikeEvent[]} pathEvents
 * @param {string} ctx
 * @param {string[]} lines
 */
function emitSubpath(pathEvents, ctx, lines) {
  if (!Array.isArray(pathEvents) || pathEvents.length === 0) {
    return;
  }
  const startsWithBegin = pathEvents[0]?.type === 'beginPath';
  if (!startsWithBegin) {
    lines.push(`${ctx}.beginPath();`);
  }
  for (const seg of pathEvents) {
    emitPathBuilding(/** @type {CanvasLikeEvent} */ (seg), ctx, lines);
  }
}

/**
 * @param {CanvasLikeEvent} event
 * @param {string} ctx
 * @param {string[]} lines
 */
function emitOne(event, ctx, lines) {
  const { type, props = {} } = event;

  switch (type) {
    case 'save':
      lines.push(`${ctx}.save();`);
      return;
    case 'restore':
      lines.push(`${ctx}.restore();`);
      return;
    case 'beginPath':
      lines.push(`${ctx}.beginPath();`);
      return;
    case 'closePath':
      lines.push(`${ctx}.closePath();`);
      return;
    case 'resetTransform':
      lines.push(`${ctx}.resetTransform();`);
      return;
    case 'clearHitRegions':
      lines.push(`${ctx}.clearHitRegions();`);
      return;

    case 'clearRect':
      lines.push(
        `${ctx}.clearRect(${lit(props.x)}, ${lit(props.y)}, ${lit(props.width)}, ${lit(props.height)});`
      );
      return;
    case 'fillRect':
      lines.push(
        `${ctx}.fillRect(${lit(props.x)}, ${lit(props.y)}, ${lit(props.width)}, ${lit(props.height)});`
      );
      return;
    case 'strokeRect':
      lines.push(
        `${ctx}.strokeRect(${lit(props.x)}, ${lit(props.y)}, ${lit(props.width)}, ${lit(props.height)});`
      );
      return;

    case 'rect':
      lines.push(
        `${ctx}.rect(${lit(props.x)}, ${lit(props.y)}, ${lit(props.width)}, ${lit(props.height)});`
      );
      return;
    case 'moveTo':
      lines.push(`${ctx}.moveTo(${lit(props.x)}, ${lit(props.y)});`);
      return;
    case 'lineTo':
      lines.push(`${ctx}.lineTo(${lit(props.x)}, ${lit(props.y)});`);
      return;
    case 'arc':
      lines.push(
        `${ctx}.arc(${lit(props.x)}, ${lit(props.y)}, ${lit(props.radius)}, ${lit(props.startAngle)}, ${lit(
          props.endAngle
        )}, ${lit(props.anticlockwise)});`
      );
      return;
    case 'arcTo':
      lines.push(
        `${ctx}.arcTo(${lit(props.cpx1)}, ${lit(props.cpy1)}, ${lit(props.cpx2)}, ${lit(props.cpy2)}, ${lit(
          props.radius
        )});`
      );
      return;
    case 'ellipse':
      lines.push(
        `${ctx}.ellipse(${lit(props.x)}, ${lit(props.y)}, ${lit(props.radiusX)}, ${lit(
          props.radiusY
        )}, ${lit(props.rotation)}, ${lit(props.startAngle)}, ${lit(props.endAngle)}, ${lit(
          props.anticlockwise
        )});`
      );
      return;
    case 'bezierCurveTo':
      lines.push(
        `${ctx}.bezierCurveTo(${lit(props.cpx1)}, ${lit(props.cpy1)}, ${lit(props.cpx2)}, ${lit(
          props.cpy2
        )}, ${lit(props.x)}, ${lit(props.y)});`
      );
      return;
    case 'quadraticCurveTo':
      lines.push(
        `${ctx}.quadraticCurveTo(${lit(props.cpx)}, ${lit(props.cpy)}, ${lit(props.x)}, ${lit(props.y)});`
      );
      return;

    case 'translate':
      lines.push(`${ctx}.translate(${lit(props.x)}, ${lit(props.y)});`);
      return;
    case 'rotate':
      lines.push(`${ctx}.rotate(${lit(props.angle)});`);
      return;
    case 'scale':
      lines.push(`${ctx}.scale(${lit(props.x)}, ${lit(props.y)});`);
      return;
    case 'transform':
      lines.push(
        `${ctx}.transform(${lit(props.a)}, ${lit(props.b)}, ${lit(props.c)}, ${lit(props.d)}, ${lit(
          props.e
        )}, ${lit(props.f)});`
      );
      return;
    case 'setTransform':
      lines.push(
        `${ctx}.setTransform(${lit(props.a)}, ${lit(props.b)}, ${lit(props.c)}, ${lit(props.d)}, ${lit(
          props.e
        )}, ${lit(props.f)});`
      );
      return;
    case 'currentTransform':
      lines.push(
        `// ${ctx}.setTransform via currentTransform — use DOMMatrix or setTransform:\n` +
          `${ctx}.setTransform(${lit(props.a)}, ${lit(props.b)}, ${lit(props.c)}, ${lit(props.d)}, ${lit(
            props.e
          )}, ${lit(props.f)});`
      );
      return;

    case 'clip': {
      const p = /** @type {any} */ (props).path;
      const fillRule = /** @type {string} */ (props.fillRule ?? 'nonzero');
      emitSubpath(/** @type {CanvasLikeEvent[]} */ (p), ctx, lines);
      lines.push(`${ctx}.clip(${lit(fillRule)});`);
      return;
    }
    case 'fill': {
      const p = /** @type {any} */ (props).path;
      const fillRule = /** @type {string} */ (props.fillRule ?? 'nonzero');
      emitSubpath(/** @type {CanvasLikeEvent[]} */ (p), ctx, lines);
      lines.push(`${ctx}.fill(${lit(fillRule)});`);
      return;
    }
    case 'stroke': {
      const p = /** @type {any} */ (props).path;
      emitSubpath(/** @type {CanvasLikeEvent[]} */ (p), ctx, lines);
      lines.push(`${ctx}.stroke();`);
      return;
    }

    case 'fillText': {
      const mw = props.maxWidth;
      if (mw == null) {
        lines.push(`${ctx}.fillText(${lit(props.text)}, ${lit(props.x)}, ${lit(props.y)});`);
      } else {
        lines.push(
          `${ctx}.fillText(${lit(props.text)}, ${lit(props.x)}, ${lit(props.y)}, ${lit(mw)});`
        );
      }
      return;
    }
    case 'strokeText': {
      const mw = props.maxWidth;
      if (mw == null) {
        lines.push(`${ctx}.strokeText(${lit(props.text)}, ${lit(props.x)}, ${lit(props.y)});`);
      } else {
        lines.push(
          `${ctx}.strokeText(${lit(props.text)}, ${lit(props.x)}, ${lit(props.y)}, ${lit(mw)});`
        );
      }
      return;
    }
    case 'measureText':
      lines.push(`${ctx}.measureText(${lit(props.text)});`);
      return;

    case 'setLineDash': {
      const segs = /** @type {number[]} */ (props.segments ?? []);
      lines.push(`${ctx}.setLineDash(${lit(segs)});`);
      return;
    }

    case 'fillStyle':
    case 'strokeStyle':
    case 'globalAlpha':
    case 'globalCompositeOperation':
    case 'lineWidth':
    case 'lineCap':
    case 'lineJoin':
    case 'miterLimit':
    case 'lineDashOffset':
    case 'font':
    case 'textAlign':
    case 'textBaseline':
    case 'filter':
    case 'direction':
    case 'imageSmoothingEnabled':
    case 'imageSmoothingQuality':
    case 'shadowBlur':
    case 'shadowColor':
    case 'shadowOffsetX':
    case 'shadowOffsetY':
      lines.push(`${ctx}.${type} = ${lit(props.value)};`);
      return;

    case 'drawImage': {
      lines.push(
        `// drawImage: image is not preserved in snapshots — supply an HTMLImageElement / Canvas / …\n` +
          `${ctx}.drawImage(image, ${lit(props.sx)}, ${lit(props.sy)}, ${lit(props.sWidth)}, ${lit(
            props.sHeight
          )}, ${lit(props.dx)}, ${lit(props.dy)}, ${lit(props.dWidth)}, ${lit(props.dHeight)});`
      );
      return;
    }
    case 'putImageData': {
      if (
        props.dirtyWidth !== undefined &&
        props.dirtyHeight !== undefined &&
        props.dirtyX !== undefined &&
        props.dirtyY !== undefined
      ) {
        lines.push(
          `// putImageData: ImageData is not in the snapshot\n` +
            `${ctx}.putImageData(imageData, ${lit(props.x)}, ${lit(props.y)}, ${lit(props.dirtyX)}, ${lit(
              props.dirtyY
            )}, ${lit(props.dirtyWidth)}, ${lit(props.dirtyHeight)});`
        );
      } else {
        lines.push(
          `// putImageData: ImageData is not in the snapshot\n` +
            `${ctx}.putImageData(imageData, ${lit(props.x)}, ${lit(props.y)});`
        );
      }
      return;
    }

    case 'createLinearGradient':
      lines.push(
        `${ctx}.createLinearGradient(${lit(props.x0)}, ${lit(props.y0)}, ${lit(props.x1)}, ${lit(props.y1)});`
      );
      return;
    case 'createRadialGradient':
      lines.push(
        `${ctx}.createRadialGradient(${lit(props.x0)}, ${lit(props.y0)}, ${lit(props.r0)}, ${lit(
          props.x1
        )}, ${lit(props.y1)}, ${lit(props.r1)});`
      );
      return;
    case 'createPattern':
      lines.push(`// createPattern: image not in snapshot\n${ctx}.createPattern(image, ${lit(props.type)});`);
      return;
    case 'createImageData': {
      lines.push(`${ctx}.createImageData(${lit(props.width)}, ${lit(props.height)});`);
      return;
    }

    case 'isPointInPath': {
      const p = /** @type {any} */ (props).path;
      lines.push(`${ctx}.beginPath();`);
      if (Array.isArray(p)) {
        for (const seg of p) {
          emitPathBuilding(/** @type {CanvasLikeEvent} */ (seg), ctx, lines);
        }
      }
      lines.push(`${ctx}.isPointInPath(${lit(props.x)}, ${lit(props.y)}, ${lit(props.fillRule ?? 'nonzero')});`);
      return;
    }

    case 'addHitRegion':
    case 'removeHitRegion':
    case 'drawFocusIfNeeded':
    case 'scrollPathIntoView':
      lines.push(`// ${type}: ${lit(props)}`);
      return;

    default:
      lines.push(`// unknown event type ${lit(type)}: ${lit(props)}`);
  }
}

/**
 * @param {unknown} data - parsed JSON from a snapshot export (expected: CanvasLikeEvent[])
 * @param {{ contextName?: string }} [options]
 * @returns {string}
 */
export function eventsToCanvasScript(data, options = {}) {
  const ctx = options.contextName ?? 'ctx';
  if (!Array.isArray(data)) {
    return `// Expected an array of canvas events, got: ${typeof data}\n`;
  }
  const lines = [];
  lines.push(`// Replay against a CanvasRenderingContext2D (jest-canvas-mock snapshot)`);
  lines.push(`// const ${ctx} = canvas.getContext('2d');`);
  lines.push('');
  for (const ev of data) {
    emitOne(/** @type {CanvasLikeEvent} */ (ev), ctx, lines);
  }
  return lines.join('\n') + '\n';
}
