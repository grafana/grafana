import type { CSSProperties } from 'react';

import { OVERLAY_BLEND_MODES } from '../constants.ts';

interface OverlayBlendSelectProps {
  value: CSSProperties['mixBlendMode'];
  onChange: (mode: CSSProperties['mixBlendMode']) => void;
}

export function OverlayBlendSelect({ value, onChange }: OverlayBlendSelectProps) {
  return (
    <select
      className="overlay-blend-select"
      value={value}
      onChange={(e) => onChange(toOverlayBlendMode(e.target.value))}
    >
      {OVERLAY_BLEND_MODES.map((mode) => (
        <option key={mode} value={mode}>
          Blend: {mode}
        </option>
      ))}
    </select>
  );
}

function toOverlayBlendMode(value: string): CSSProperties['mixBlendMode'] {
  return OVERLAY_BLEND_MODES.find((mode) => mode === value) ?? 'exclusion';
}
