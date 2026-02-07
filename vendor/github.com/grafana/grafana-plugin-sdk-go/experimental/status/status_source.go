package status

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"syscall"

	grpccodes "google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
)

// Source type defines the status source.
type Source string

const (
	// SourcePlugin status originates from plugin.
	SourcePlugin Source = "plugin"

	// SourceDownstream status originates from downstream service.
	SourceDownstream Source = "downstream"

	// DefaultSource is the default [Source] that should be used when it is not explicitly set.
	DefaultSource Source = SourcePlugin
)

func NewErrorWithSource(err error, source Source) ErrorWithSource {
	return ErrorWithSource{
		source: source,
		err:    err,
	}
}

// IsValid return true if es is [SourceDownstream] or [SourcePlugin].
func (s Source) IsValid() bool {
	return s == SourceDownstream || s == SourcePlugin
}

// String returns the string representation of s. If s is not valid, [DefaultSource] is returned.
func (s Source) String() string {
	if !s.IsValid() {
		return string(DefaultSource)
	}

	return string(s)
}

// ErrorSourceFromStatus returns a [Source] based on provided HTTP status code.
func SourceFromHTTPStatus(statusCode int) Source {
	switch statusCode {
	case http.StatusMethodNotAllowed,
		http.StatusNotAcceptable,
		http.StatusPreconditionFailed,
		http.StatusRequestEntityTooLarge,
		http.StatusRequestHeaderFieldsTooLarge,
		http.StatusRequestURITooLong,
		http.StatusExpectationFailed,
		http.StatusUpgradeRequired,
		http.StatusRequestedRangeNotSatisfiable,
		http.StatusNotImplemented:
		return SourcePlugin
	}

	return SourceDownstream
}

type ErrorWithSource struct {
	source Source
	err    error
}

// DownstreamError creates a new error with status [SourceDownstream].
func DownstreamError(err error) error {
	return NewErrorWithSource(err, SourceDownstream)
}

// DownstreamError creates a new error with status [SourcePlugin].
func PluginError(err error) error {
	return NewErrorWithSource(err, SourcePlugin)
}

// DownstreamErrorf creates a new error with status [SourceDownstream] and formats
// according to a format specifier and returns the string as a value that satisfies error.
func DownstreamErrorf(format string, a ...any) error {
	return DownstreamError(fmt.Errorf(format, a...))
}

// PluginErrorf creates a new error with status [ErrorSourcePlugin] and formats
// according to a format specifier and returns the string as a value that satisfies error.
func PluginErrorf(format string, a ...any) error {
	return PluginError(fmt.Errorf(format, a...))
}

func (e ErrorWithSource) ErrorSource() Source {
	return e.source
}

// @deprecated Use [ErrorSource] instead.
func (e ErrorWithSource) Source() Source {
	return e.source
}

func (e ErrorWithSource) Error() string {
	return e.err.Error()
}

// Implements the interface used by [errors.Is].
func (e ErrorWithSource) Is(err error) bool {
	if errWithSource, ok := err.(ErrorWithSource); ok {
		return errWithSource.ErrorSource() == e.source
	}

	return false
}

func (e ErrorWithSource) Unwrap() error {
	return e.err
}

func IsPluginError(err error) bool {
	e := ErrorWithSource{
		source: SourcePlugin,
	}
	return errors.Is(err, e)
}

// IsDownstreamError return true if provided error is an error with downstream source or
// a timeout error or a cancelled error.
func IsDownstreamError(err error) bool {
	e := ErrorWithSource{
		source: SourceDownstream,
	}
	if errors.Is(err, e) {
		return true
	}

	return isHTTPTimeoutError(err) || IsCancelledError(err)
}

// IsDownstreamHTTPError return true if provided error is an error with downstream source or
// a HTTP timeout error or a cancelled error or a connection reset/refused error or dns not found error.
func IsDownstreamHTTPError(err error) bool {
	return IsDownstreamError(err) ||
		isNetworkSyscallConnectionError(err) ||
		isDNSNotFoundError(err) ||
		isTLSCertificateVerificationError(err) ||
		isHTTPEOFError(err)
}

// InCancelledError returns true if err is context.Canceled or is gRPC status Canceled.
func IsCancelledError(err error) bool {
	return errors.Is(err, context.Canceled) || grpcstatus.Code(err) == grpccodes.Canceled
}

func isHTTPTimeoutError(err error) bool {
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}

	return errors.Is(err, os.ErrDeadlineExceeded) // replacement for os.IsTimeout(err)
}

func isNetworkSyscallConnectionError(err error) bool {
	var netErr *net.OpError
	if errors.As(err, &netErr) {
		var sysErr *os.SyscallError
		if errors.As(netErr.Err, &sysErr) {
			return errors.Is(sysErr.Err, syscall.ECONNRESET) || errors.Is(sysErr.Err, syscall.ECONNREFUSED) || errors.Is(sysErr.Err, syscall.EHOSTUNREACH) || errors.Is(sysErr.Err, syscall.ENETUNREACH)
		}
	}

	return false
}

func isDNSNotFoundError(err error) bool {
	var dnsError *net.DNSError
	if errors.As(err, &dnsError) && dnsError.IsNotFound {
		return true
	}

	return false
}

// isTLSCertificateVerificationError checks if the error is related to TLS certificate verification.
func isTLSCertificateVerificationError(err error) bool {
	var (
		certErr             x509.CertificateInvalidError
		unknownAuthorityErr x509.UnknownAuthorityError
		hostnameErr         x509.HostnameError
		tlsError            *tls.CertificateVerificationError
	)
	return errors.As(err, &certErr) ||
		errors.As(err, &unknownAuthorityErr) ||
		errors.As(err, &hostnameErr) ||
		errors.As(err, &tlsError)
}

// isHTTPEOFError returns true if the error is an EOF error inside of url.Error or net.OpError, indicating the connection was closed prematurely by server
func isHTTPEOFError(err error) bool {
	var netErr *net.OpError
	if errors.As(err, &netErr) {
		return errors.Is(netErr.Err, io.EOF)
	}

	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return errors.Is(urlErr.Err, io.EOF)
	}
	return false
}

type sourceCtxKey struct{}

// SourceFromContext returns the source stored in the context.
// If no source is stored in the context, [DefaultSource] is returned.
func SourceFromContext(ctx context.Context) Source {
	value, ok := ctx.Value(sourceCtxKey{}).(*Source)
	if ok {
		return *value
	}
	return DefaultSource
}

// InitSource initialize the source for the context.
func InitSource(ctx context.Context) context.Context {
	s := DefaultSource
	return context.WithValue(ctx, sourceCtxKey{}, &s)
}

// WithSource mutates the provided context by setting the source to
// s. If the provided context does not have a source, the context
// will not be mutated and an error returned. This means that [InitSource]
// has to be called before this function.
func WithSource(ctx context.Context, s Source) error {
	v, ok := ctx.Value(sourceCtxKey{}).(*Source)
	if !ok {
		return errors.New("the provided context does not have a status source")
	}
	*v = s
	return nil
}

// WithDownstreamSource mutates the provided context by setting the source to
// [SourceDownstream]. If the provided context does not have a source, the context
// will not be mutated and an error returned. This means that [InitSource] has to be
// called before this function.
func WithDownstreamSource(ctx context.Context) error {
	return WithSource(ctx, SourceDownstream)
}
