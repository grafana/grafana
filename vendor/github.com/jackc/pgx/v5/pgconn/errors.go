package pgconn

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
)

// SafeToRetry checks if the err is guaranteed to have occurred before sending any data to the server.
func SafeToRetry(err error) bool {
	var retryableErr interface{ SafeToRetry() bool }
	if errors.As(err, &retryableErr) {
		return retryableErr.SafeToRetry()
	}
	return false
}

// Timeout checks if err was caused by a timeout. To be specific, it is true if err was caused within pgconn by a
// context.DeadlineExceeded or an implementer of net.Error where Timeout() is true.
func Timeout(err error) bool {
	var timeoutErr *errTimeout
	return errors.As(err, &timeoutErr)
}

// PgError represents an error reported by the PostgreSQL server. See
// http://www.postgresql.org/docs/current/static/protocol-error-fields.html for
// detailed field description.
type PgError struct {
	Severity            string
	SeverityUnlocalized string
	Code                string
	Message             string
	Detail              string
	Hint                string
	Position            int32
	InternalPosition    int32
	InternalQuery       string
	Where               string
	SchemaName          string
	TableName           string
	ColumnName          string
	DataTypeName        string
	ConstraintName      string
	File                string
	Line                int32
	Routine             string
}

func (pe *PgError) Error() string {
	return pe.Severity + ": " + pe.Message + " (SQLSTATE " + pe.Code + ")"
}

// SQLState returns the SQLState of the error.
func (pe *PgError) SQLState() string {
	return pe.Code
}

// ConnectError is the error returned when a connection attempt fails.
type ConnectError struct {
	Config *Config // The configuration that was used in the connection attempt.
	err    error
}

func (e *ConnectError) Error() string {
	prefix := fmt.Sprintf("failed to connect to `user=%s database=%s`:", e.Config.User, e.Config.Database)
	details := e.err.Error()
	if strings.Contains(details, "\n") {
		return prefix + "\n\t" + strings.ReplaceAll(details, "\n", "\n\t")
	} else {
		return prefix + " " + details
	}
}

func (e *ConnectError) Unwrap() error {
	return e.err
}

type perDialConnectError struct {
	address          string
	originalHostname string
	err              error
}

func (e *perDialConnectError) Error() string {
	return fmt.Sprintf("%s (%s): %s", e.address, e.originalHostname, e.err.Error())
}

func (e *perDialConnectError) Unwrap() error {
	return e.err
}

type connLockError struct {
	status string
}

func (e *connLockError) SafeToRetry() bool {
	return true // a lock failure by definition happens before the connection is used.
}

func (e *connLockError) Error() string {
	return e.status
}

// ParseConfigError is the error returned when a connection string cannot be parsed.
type ParseConfigError struct {
	ConnString string // The connection string that could not be parsed.
	msg        string
	err        error
}

func NewParseConfigError(conn, msg string, err error) error {
	return &ParseConfigError{
		ConnString: conn,
		msg:        msg,
		err:        err,
	}
}

func (e *ParseConfigError) Error() string {
	// Now that ParseConfigError is public and ConnString is available to the developer, perhaps it would be better only
	// return a static string. That would ensure that the error message cannot leak a password. The ConnString field would
	// allow access to the original string if desired and Unwrap would allow access to the underlying error.
	connString := redactPW(e.ConnString)
	if e.err == nil {
		return fmt.Sprintf("cannot parse `%s`: %s", connString, e.msg)
	}
	return fmt.Sprintf("cannot parse `%s`: %s (%s)", connString, e.msg, e.err.Error())
}

func (e *ParseConfigError) Unwrap() error {
	return e.err
}

func normalizeTimeoutError(ctx context.Context, err error) error {
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		if ctx.Err() == context.Canceled {
			// Since the timeout was caused by a context cancellation, the actual error is context.Canceled not the timeout error.
			return context.Canceled
		} else if ctx.Err() == context.DeadlineExceeded {
			return &errTimeout{err: ctx.Err()}
		} else {
			return &errTimeout{err: netErr}
		}
	}
	return err
}

type pgconnError struct {
	msg         string
	err         error
	safeToRetry bool
}

func (e *pgconnError) Error() string {
	if e.msg == "" {
		return e.err.Error()
	}
	if e.err == nil {
		return e.msg
	}
	return fmt.Sprintf("%s: %s", e.msg, e.err.Error())
}

func (e *pgconnError) SafeToRetry() bool {
	return e.safeToRetry
}

func (e *pgconnError) Unwrap() error {
	return e.err
}

// errTimeout occurs when an error was caused by a timeout. Specifically, it wraps an error which is
// context.Canceled, context.DeadlineExceeded, or an implementer of net.Error where Timeout() is true.
type errTimeout struct {
	err error
}

func (e *errTimeout) Error() string {
	return fmt.Sprintf("timeout: %s", e.err.Error())
}

func (e *errTimeout) SafeToRetry() bool {
	return SafeToRetry(e.err)
}

func (e *errTimeout) Unwrap() error {
	return e.err
}

type contextAlreadyDoneError struct {
	err error
}

func (e *contextAlreadyDoneError) Error() string {
	return fmt.Sprintf("context already done: %s", e.err.Error())
}

func (e *contextAlreadyDoneError) SafeToRetry() bool {
	return true
}

func (e *contextAlreadyDoneError) Unwrap() error {
	return e.err
}

// newContextAlreadyDoneError double-wraps a context error in `contextAlreadyDoneError` and `errTimeout`.
func newContextAlreadyDoneError(ctx context.Context) (err error) {
	return &errTimeout{&contextAlreadyDoneError{err: ctx.Err()}}
}

func redactPW(connString string) string {
	if strings.HasPrefix(connString, "postgres://") || strings.HasPrefix(connString, "postgresql://") {
		if u, err := url.Parse(connString); err == nil {
			return redactURL(u)
		}
	}
	quotedKV := regexp.MustCompile(`password='[^']*'`)
	connString = quotedKV.ReplaceAllLiteralString(connString, "password=xxxxx")
	plainKV := regexp.MustCompile(`password=[^ ]*`)
	connString = plainKV.ReplaceAllLiteralString(connString, "password=xxxxx")
	brokenURL := regexp.MustCompile(`:[^:@]+?@`)
	connString = brokenURL.ReplaceAllLiteralString(connString, ":xxxxxx@")
	return connString
}

func redactURL(u *url.URL) string {
	if u == nil {
		return ""
	}
	if _, pwSet := u.User.Password(); pwSet {
		u.User = url.UserPassword(u.User.Username(), "xxxxx")
	}
	return u.String()
}

type NotPreferredError struct {
	err         error
	safeToRetry bool
}

func (e *NotPreferredError) Error() string {
	return fmt.Sprintf("standby server not found: %s", e.err.Error())
}

func (e *NotPreferredError) SafeToRetry() bool {
	return e.safeToRetry
}

func (e *NotPreferredError) Unwrap() error {
	return e.err
}

type PrepareError struct {
	err error

	ParseComplete bool // Indicates whether the error occurred after a ParseComplete message was received.
}

func (e *PrepareError) Error() string {
	if e.ParseComplete {
		return fmt.Sprintf("prepare failed after ParseComplete: %s", e.err.Error())
	}
	return e.err.Error()
}

func (e *PrepareError) Unwrap() error {
	return e.err
}
