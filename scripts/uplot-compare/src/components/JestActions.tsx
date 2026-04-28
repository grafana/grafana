export function JestActions(props: {
  testPath: string | undefined;
  kind: 'idle' | 'running' | 'success' | 'error';
  onRerunTest: () => void;
  updateSnapshot?: boolean;
  onAcceptBaseline: () => void;
  message?: string;
  command: string | undefined;
  stdout: string;
  stderr: string;
}) {
  return (
    <div className="accept-baseline-panel">
      <div className="accept-baseline-actions">
        <button
          type="button"
          className="jest-rerun-btn"
          disabled={!props.testPath || props.kind === 'running'}
          title={
            props.testPath
              ? 'Run jest for this test only (does not update snapshots)'
              : 'Re-run the failing test to regenerate the payload with testPath'
          }
          onClick={props.onRerunTest}
        >
          {props.kind === 'running' && !props.updateSnapshot ? 'Running jest…' : 'Re-run test'}
        </button>
        <button
          type="button"
          className="accept-baseline-btn"
          disabled={!props.testPath || props.kind === 'running'}
          title={
            props.testPath
              ? 'Run jest with --updateSnapshot for this test only'
              : 'Re-run the failing test to regenerate the payload with testPath'
          }
          onClick={props.onAcceptBaseline}
        >
          {props.kind === 'running' && props.updateSnapshot ? 'Running jest -u…' : 'Accept baseline (jest -u)'}
        </button>
      </div>
      {props.kind === 'success' && props.updateSnapshot ? (
        <p className="accept-baseline-success" role="status">
          Snapshot updated. Payload kept; re-run the test to verify.
        </p>
      ) : null}
      {props.kind === 'success' && !props.updateSnapshot ? (
        <p className="accept-baseline-success" role="status">
          Test passed. Snapshot was not updated. If it still fails, a new compare payload is written on the next
          failure.
        </p>
      ) : null}
      {props.kind === 'error' ? (
        <p className="accept-baseline-error" role="alert">
          {props.message}
        </p>
      ) : null}
      {props.kind === 'success' || props.kind === 'error' ? (
        <details className="accept-baseline-output">
          <summary>jest output</summary>
          {props.command ? <pre className="accept-baseline-command">{props.command}</pre> : null}
          {props.stdout ? <pre className="accept-baseline-stdout">{props.stdout}</pre> : null}
          {props.stderr ? <pre className="accept-baseline-stderr">{props.stderr}</pre> : null}
        </details>
      ) : null}
    </div>
  );
}
