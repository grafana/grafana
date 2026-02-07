package authn

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/authlib/cache"
	"github.com/grafana/authlib/internal/httpclient"
	"github.com/grafana/dskit/backoff"
)

// Provided for mockability of client
type TokenExchanger interface {
	Exchange(ctx context.Context, r TokenExchangeRequest) (*TokenExchangeResponse, error)
}

var _ TokenExchanger = &TokenExchangeClient{}

// ExchangeClientOpts allows setting custom parameters during construction.
type ExchangeClientOpts func(c *TokenExchangeClient)

// WithHTTPClient allows setting the HTTP client to be used by the token exchange client.
func WithHTTPClient(client *http.Client) ExchangeClientOpts {
	return func(c *TokenExchangeClient) {
		c.client = client
	}
}

func WithTokenExchangeClientCache(cache cache.Cache) ExchangeClientOpts {
	return func(c *TokenExchangeClient) {
		c.cache = cache
	}
}

func WithTracer(tracer trace.Tracer) ExchangeClientOpts {
	return func(c *TokenExchangeClient) {
		c.tracer = tracer
	}
}

func NewTokenExchangeClient(cfg TokenExchangeConfig, opts ...ExchangeClientOpts) (*TokenExchangeClient, error) {
	if cfg.Token == "" {
		return nil, fmt.Errorf("%w: missing required token", ErrMissingConfig)
	}

	if cfg.TokenExchangeURL == "" {
		return nil, fmt.Errorf("%w: missing required token exchange url", ErrMissingConfig)
	}

	c := &TokenExchangeClient{
		cache:   nil, // See below.
		cfg:     cfg,
		singlef: singleflight.Group{},
		tracer:  noop.NewTracerProvider().Tracer("authn.TokenExchangeClient"),
		backoffCfg: backoff.Config{
			MaxBackoff: time.Second,
			MinBackoff: 250 * time.Millisecond,
			MaxRetries: 3,
		},
	}

	for _, opt := range opts {
		opt(c)
	}

	if c.client == nil {
		c.client = httpclient.New()
	}

	// If the options did not set the cache, create a new local cache.
	//
	// This has to be done this way because the cache that is created by
	// the cache.NewLocalCache function spawns a goroutine that cannot be
	// trivially stopped. It is set up to stop when the object is garbage
	// collected, but in the general case, the calling code will not have
	// control over that.
	if c.cache == nil {
		c.cache = cache.NewLocalCache(cache.Config{
			CleanupInterval: 5 * time.Minute,
		})
	}

	return c, nil

}

type TokenExchangeClient struct {
	cache      cache.Cache
	cfg        TokenExchangeConfig
	client     *http.Client
	singlef    singleflight.Group
	tracer     trace.Tracer
	backoffCfg backoff.Config
}

type TokenExchangeRequest struct {
	// Namespace token should be signed with.
	// Use wildcard '*' to create a token for all namespaces.
	Namespace string `json:"namespace"`
	// Audiences token should be signed with.
	Audiences []string `json:"audiences"`
	// [Optional] SubjectToken is the token to exchange in case of a token exchange request.
	SubjectToken string `json:"subjectToken,omitempty"`
	// [Optional] ExpiresIn is the duration, in seconds, before the token expires.
	ExpiresIn *int `json:"expiresIn,omitempty"`
}

type TokenExchangeResponse struct {
	Token string
}

func (r TokenExchangeRequest) hash() string {
	br := strings.Builder{}
	br.WriteString(r.Namespace)
	br.WriteByte('-')
	sort.Strings(r.Audiences)
	br.WriteString(strings.Join(r.Audiences, "-"))
	br.WriteString(r.SubjectToken)

	return br.String()
}

type tokenExchangeResponse struct {
	Data   tokenExchangeData `json:"data"`
	Status string            `json:"status"`
	Error  string            `json:"error"`
}

type tokenExchangeData struct {
	Token string `json:"token"`
}

func (c *TokenExchangeClient) Exchange(ctx context.Context, r TokenExchangeRequest) (*TokenExchangeResponse, error) {
	ctx, span := c.tracer.Start(ctx, "authn.TokenExchangeClient.Exchange")
	defer span.End()
	span.SetAttributes(attribute.Bool("cache_hit", false))

	if r.Namespace == "" {
		return nil, ErrMissingNamespace
	}

	if len(r.Audiences) == 0 {
		return nil, ErrMissingAudiences
	}

	key := r.hash()
	token, ok := c.getCache(ctx, key)
	if ok {
		span.SetAttributes(attribute.Bool("cache_hit", true))
		return &TokenExchangeResponse{Token: token}, nil
	}

	resp, err, _ := c.singlef.Do(key, func() (interface{}, error) {
		data, err := json.Marshal(&r)
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrInvalidExchangeResponse, err)
		}

		b := backoff.New(ctx, c.backoffCfg)

		var req *http.Request
		var res *http.Response
		for b.Ongoing() {
			req, err = http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.TokenExchangeURL, bytes.NewReader(data))
			if err != nil {
				return nil, fmt.Errorf("failed to build http request: %w", err)
			}

			res, err = c.client.Do(c.withHeaders(req))
			addResponseInformationToSpan(span, res, err)
			// Retry the request if there was a fundamental error, like resolving the host or network error,
			// or if we get a 429 or a 500s HTTP status code
			if shouldRetry(res, err) {
				// Consume and close response body after each attempt, so connections can be reused
				if res != nil {
					_, _ = io.Copy(io.Discard, res.Body)
					_ = res.Body.Close()
				}

				b.Wait()
				continue
			}

			defer func() { _ = res.Body.Close() }()

			// No error, exit the retry loop
			break
		}

		if err != nil || b.Err() != nil {
			// If we get here, it means we had hit the MaxRetries limit or an error happened
			// while retrying the request (for example, context canceled).
			return nil, fmt.Errorf("%w: %w", ErrInvalidExchangeResponse, errors.Join(b.Err(), err))
		}

		if res.StatusCode >= http.StatusInternalServerError {
			return nil, fmt.Errorf("%w: %s", ErrInvalidExchangeResponse, res.Status)
		}

		response := tokenExchangeResponse{}
		if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
			return nil, err
		}

		if res.StatusCode != http.StatusOK {
			if response.Error != "" {
				return nil, fmt.Errorf("%w: %s", ErrInvalidExchangeResponse, response.Error)
			}
			return nil, fmt.Errorf("%w: %s", ErrInvalidExchangeResponse, res.Status)
		}

		// FIXME: for now we ignore errors when updating the cache becasue we still
		// have a valid response to return.
		_ = c.setCache(ctx, response.Data.Token, key)
		return response, nil
	})

	if err != nil {
		return nil, err
	}

	response := resp.(tokenExchangeResponse)
	return &TokenExchangeResponse{Token: response.Data.Token}, nil
}

// shouldRetry determines whether a request should be retried based on the HTTP response status code
// or the presence of an error. It returns true for HTTP 429 (Too Many Requests) or server errors
// (HTTP status codes 500 and above).
func shouldRetry(res *http.Response, err error) bool {
	if err != nil {
		return true
	}
	if res != nil {
		return res.StatusCode == http.StatusTooManyRequests || res.StatusCode >= http.StatusInternalServerError
	}
	return false
}

// addResponseInformationToSpan adds an event to the span indicating error and HTTP status code
func addResponseInformationToSpan(span trace.Span, res *http.Response, err error) {
	if err != nil {
		span.RecordError(err)
	} else {
		span.AddEvent("response", trace.WithAttributes(attribute.Int("status", res.StatusCode)))
	}
}

func (c *TokenExchangeClient) withHeaders(r *http.Request) *http.Request {
	r.Header.Set("Authorization", "Bearer "+c.cfg.Token)
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Accept", "application/json")
	r.Header.Set("User-Agent", "authlib-client")

	// Always propagate system token headers.
	// These will be ignored for non system tokens.
	r.Header.Set("X-Org-ID", "0")
	r.Header.Set("X-Realms", `[{"type": "system", "identifier": "system"}]`)

	// Propagate OpenTelemetry context headers.
	otel.GetTextMapPropagator().Inject(r.Context(), propagation.HeaderCarrier(r.Header))

	return r
}

func (c *TokenExchangeClient) getCache(ctx context.Context, key string) (string, bool) {
	if token, err := c.cache.Get(ctx, key); err == nil {
		return string(token), true
	}
	return "", false
}

func (c *TokenExchangeClient) setCache(ctx context.Context, token string, key string) error {
	const cacheLeeway = 15 * time.Second

	parsed, err := jwt.ParseSigned(token, tokenSignAlgs)
	if err != nil {
		return fmt.Errorf("failed to parse token: %v", err)
	}

	var claims jwt.Claims
	if err = parsed.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return fmt.Errorf("failed to extract claims from the token: %v", err)
	}

	return c.cache.Set(ctx, key, []byte(token), time.Until(claims.Expiry.Time())-cacheLeeway)
}

var _ TokenExchanger = StaticTokenExchanger{}

// NewStaticTokenExchanger Constructs a TokenExchanger that always returned provided token
func NewStaticTokenExchanger(token string) StaticTokenExchanger {
	return StaticTokenExchanger{token}
}

type StaticTokenExchanger struct {
	token string
}

func (s StaticTokenExchanger) Exchange(ctx context.Context, r TokenExchangeRequest) (*TokenExchangeResponse, error) {
	return &TokenExchangeResponse{Token: s.token}, nil
}
