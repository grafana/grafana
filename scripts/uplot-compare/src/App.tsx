import { CompareUPlotCanvasOutputs } from './components/CompareUPlotCanvasOutputs.tsx';

/** Default canvas when payload JSON has no `width`/`height` (e.g. hand-built URL). */
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 200;

export function App() {
  return <CompareUPlotCanvasOutputs defaultWidth={DEFAULT_WIDTH} defaultHeight={DEFAULT_HEIGHT} />;
}
