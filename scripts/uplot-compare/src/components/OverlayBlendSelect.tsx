import { OVERLAY_BLEND_MODES } from '../constants.ts';
import type { OverlayBlendMode } from '../types.ts';

interface OverlayBlendSelectProps {
  value: OverlayBlendMode;
  onChange: (mode: OverlayBlendMode) => void;
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

function toOverlayBlendMode(value: string): OverlayBlendMode {
  return OVERLAY_BLEND_MODES.find((mode) => mode === value) ?? 'exclusion';
}
