package engineconn

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"

	"github.com/Khan/genqlient/graphql"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"dagger.io/dagger/telemetry"
)

type EngineConn interface {
	graphql.Doer
	Host() string
	Close() error
}

type Config struct {
	Workdir         string
	LogOutput       io.Writer
	RunnerHost      string
	Conn            EngineConn
	VersionOverride string
	Verbosity       int
	ExtraEnv        []string
}

type ConnectParams struct {
	Port         int    `json:"port"`
	SessionToken string `json:"session_token"`
}

func Get(ctx context.Context, cfg *Config) (EngineConn, error) {
	// Prefer explicitly set conn
	if cfg.Conn != nil {
		return cfg.Conn, nil
	}

	// Try DAGGER_SESSION_PORT next
	conn, ok, err := FromSessionEnv()
	if err != nil {
		return nil, err
	}
	if ok {
		if cfg.Workdir != "" {
			return nil, fmt.Errorf("cannot configure workdir for existing session (please use --workdir or host.directory with absolute paths instead)")
		}
		return conn, nil
	}

	// Try _EXPERIMENTAL_DAGGER_CLI_BIN next
	conn, ok, err = FromLocalCLI(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if ok {
		return conn, nil
	}

	// Fallback to downloading the CLI
	conn, err = FromDownloadedCLI(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

func fallbackSpanContext(ctx context.Context) context.Context {
	if trace.SpanContextFromContext(ctx).IsValid() {
		return ctx
	}
	return telemetry.Propagator.Extract(ctx, telemetry.NewEnvCarrier(true))
}

func defaultHTTPClient(p *ConnectParams) *http.Client {
	dialTransport := &http.Transport{
		DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
			return net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", p.Port))
		},
	}
	return &http.Client{
		Transport: RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
			r.SetBasicAuth(p.SessionToken, "")

			// detect $TRACEPARENT set by 'dagger run'
			r = r.WithContext(fallbackSpanContext(r.Context()))

			// propagate span context via headers (i.e. for Dagger-in-Dagger)
			telemetry.Propagator.Inject(r.Context(), propagation.HeaderCarrier(r.Header))

			return dialTransport.RoundTrip(r)
		}),
	}
}

type RoundTripperFunc func(*http.Request) (*http.Response, error)

func (f RoundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}
