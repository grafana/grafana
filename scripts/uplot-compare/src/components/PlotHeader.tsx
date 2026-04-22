export function PlotHeader(props: { onClick: () => void; renderActualSetupEvents: boolean }) {
  return (
    <div className="plot-header">
      <div className={'plot-label'}>Actual</div>
      <button className="plot-action-btn" type="button" onClick={props.onClick}>
        {props.renderActualSetupEvents ? 'Hide uPlot setup' : 'Show uPlot setup'}
      </button>
    </div>
  );
}
