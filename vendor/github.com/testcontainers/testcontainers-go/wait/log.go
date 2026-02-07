package wait

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"
	"time"
)

// Implement interface
var (
	_ Strategy        = (*LogStrategy)(nil)
	_ StrategyTimeout = (*LogStrategy)(nil)
)

// PermanentError is a special error that will stop the wait and return an error.
type PermanentError struct {
	err error
}

// Error implements the error interface.
func (e *PermanentError) Error() string {
	return e.err.Error()
}

// NewPermanentError creates a new PermanentError.
func NewPermanentError(err error) *PermanentError {
	return &PermanentError{err: err}
}

// LogStrategy will wait until a given log entry shows up in the docker logs
type LogStrategy struct {
	// all Strategies should have a startupTimeout to avoid waiting infinitely
	timeout *time.Duration

	// additional properties
	Log          string
	IsRegexp     bool
	Occurrence   int
	PollInterval time.Duration

	// check is the function that will be called to check if the log entry is present.
	check func([]byte) error

	// submatchCallback is a callback that will be called with the sub matches of the regexp.
	submatchCallback func(pattern string, matches [][][]byte) error

	// re is the optional compiled regexp.
	re *regexp.Regexp

	// log byte slice version of [LogStrategy.Log] used for count checks.
	log []byte
}

// NewLogStrategy constructs with polling interval of 100 milliseconds and startup timeout of 60 seconds by default
func NewLogStrategy(log string) *LogStrategy {
	return &LogStrategy{
		Log:          log,
		IsRegexp:     false,
		Occurrence:   1,
		PollInterval: defaultPollInterval(),
	}
}

// fluent builders for each property
// since go has neither covariance nor generics, the return type must be the type of the concrete implementation
// this is true for all properties, even the "shared" ones like startupTimeout

// AsRegexp can be used to change the default behavior of the log strategy to use regexp instead of plain text
func (ws *LogStrategy) AsRegexp() *LogStrategy {
	ws.IsRegexp = true
	return ws
}

// Submatch configures a function that will be called with the result of
// [regexp.Regexp.FindAllSubmatch], allowing the caller to process the results.
// If the callback returns nil, the strategy will be considered successful.
// Returning a [PermanentError] will stop the wait and return an error, otherwise
// it will retry until the timeout is reached.
// [LogStrategy.Occurrence] is ignored if this option is set.
func (ws *LogStrategy) Submatch(callback func(pattern string, matches [][][]byte) error) *LogStrategy {
	ws.submatchCallback = callback

	return ws
}

// WithStartupTimeout can be used to change the default startup timeout
func (ws *LogStrategy) WithStartupTimeout(timeout time.Duration) *LogStrategy {
	ws.timeout = &timeout
	return ws
}

// WithPollInterval can be used to override the default polling interval of 100 milliseconds
func (ws *LogStrategy) WithPollInterval(pollInterval time.Duration) *LogStrategy {
	ws.PollInterval = pollInterval
	return ws
}

func (ws *LogStrategy) WithOccurrence(o int) *LogStrategy {
	// the number of occurrence needs to be positive
	if o <= 0 {
		o = 1
	}
	ws.Occurrence = o
	return ws
}

// ForLog is the default construction for the fluid interface.
//
// For Example:
//
//	wait.
//		ForLog("some text").
//		WithPollInterval(1 * time.Second)
func ForLog(log string) *LogStrategy {
	return NewLogStrategy(log)
}

func (ws *LogStrategy) Timeout() *time.Duration {
	return ws.timeout
}

// WaitUntilReady implements Strategy.WaitUntilReady
func (ws *LogStrategy) WaitUntilReady(ctx context.Context, target StrategyTarget) error {
	timeout := defaultStartupTimeout()
	if ws.timeout != nil {
		timeout = *ws.timeout
	}

	switch {
	case ws.submatchCallback != nil:
		ws.re = regexp.MustCompile(ws.Log)
		ws.check = ws.checkSubmatch
	case ws.IsRegexp:
		ws.re = regexp.MustCompile(ws.Log)
		ws.check = ws.checkRegexp
	default:
		ws.log = []byte(ws.Log)
		ws.check = ws.checkCount
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var lastLen int
	var lastError error
	for {
		select {
		case <-ctx.Done():
			return errors.Join(lastError, ctx.Err())
		default:
			checkErr := checkTarget(ctx, target)

			reader, err := target.Logs(ctx)
			if err != nil {
				// TODO: fix as this will wait for timeout if the logs are not available.
				time.Sleep(ws.PollInterval)
				continue
			}

			b, err := io.ReadAll(reader)
			if err != nil {
				// TODO: fix as this will wait for timeout if the logs are not readable.
				time.Sleep(ws.PollInterval)
				continue
			}

			if lastLen == len(b) && checkErr != nil {
				// Log length hasn't changed so we're not making progress.
				return checkErr
			}

			if err := ws.check(b); err != nil {
				var errPermanent *PermanentError
				if errors.As(err, &errPermanent) {
					return err
				}

				lastError = err
				lastLen = len(b)
				time.Sleep(ws.PollInterval)
				continue
			}

			return nil
		}
	}
}

// checkCount checks if the log entry is present in the logs using a string count.
func (ws *LogStrategy) checkCount(b []byte) error {
	if count := bytes.Count(b, ws.log); count < ws.Occurrence {
		return fmt.Errorf("%q matched %d times, expected %d", ws.Log, count, ws.Occurrence)
	}

	return nil
}

// checkRegexp checks if the log entry is present in the logs using a regexp count.
func (ws *LogStrategy) checkRegexp(b []byte) error {
	if matches := ws.re.FindAll(b, -1); len(matches) < ws.Occurrence {
		return fmt.Errorf("`%s` matched %d times, expected %d", ws.Log, len(matches), ws.Occurrence)
	}

	return nil
}

// checkSubmatch checks if the log entry is present in the logs using a regexp sub match callback.
func (ws *LogStrategy) checkSubmatch(b []byte) error {
	return ws.submatchCallback(ws.Log, ws.re.FindAllSubmatch(b, -1))
}
