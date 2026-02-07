package authz

import (
	"bytes"
	"context"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	goquery "github.com/google/go-querystring/query"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/cache"
	"github.com/grafana/authlib/internal/httpclient"
)

var _ searchclient = &searchClientImpl{}

var (
	ErrInvalidQuery          = errors.New("invalid query")
	ErrInvalidIDToken        = errors.New("invalid id token: cannot extract namespaced ID")
	ErrInvalidToken          = errors.New("invalid token: cannot query server")
	ErrInvalidResponse       = errors.New("invalid response from server")
	ErrUnexpectedStatus      = errors.New("unexpected response status")
	ErrInvalidTokenNamespace = errors.New("invalid token: can only query server for users and service-accounts")
)

const (
	cacheExp                = 5 * time.Minute
	searchPath              = "/api/access-control/users/permissions/search"
	NamespaceServiceAccount = "service-account"
	NamespaceUser           = "user"
)

// withHTTPClient allows overriding the default Doer, which is
// automatically created using http.Client. This is useful for tests.
func withHTTPClient(doer HTTPRequestDoer) searchClientOption {
	return func(c *searchClientImpl) error {
		c.client = doer

		return nil
	}
}

// withCache allows overriding the default cache, which is a local cache.
func withCache(cache cache.Cache) searchClientOption {
	return func(c *searchClientImpl) error {
		c.cache = cache

		return nil
	}
}

func newClient(cfg Config, opts ...searchClientOption) (*searchClientImpl, error) {
	client := &searchClientImpl{
		singlef: singleflight.Group{},
		client:  nil,
		cache:   nil,
		cfg:     cfg,
	}

	for _, opt := range opts {
		if err := opt(client); err != nil {
			return nil, err
		}
	}

	if client.cache == nil {
		client.cache = cache.NewLocalCache(cache.Config{
			Expiry:          cacheExp,
			CleanupInterval: 1 * time.Minute,
		})
	}

	// create httpClient, if not already present
	if client.client == nil {
		client.client = httpclient.New()
	}

	client.verifier = authn.NewVerifier[customClaims](
		authn.VerifierConfig{},
		authn.TokenTypeID,
		authn.NewKeyRetriever(authn.KeyRetrieverConfig{SigningKeysURL: cfg.JWKsURL}, authn.WithHTTPClientKeyRetrieverOpt(client.client.(*http.Client))),
	)

	return client, nil
}

type searchClientImpl struct {
	cache    cache.Cache
	cfg      Config
	client   HTTPRequestDoer
	verifier authn.Verifier[customClaims]
	singlef  singleflight.Group
}

func searchCacheKey(query searchQuery) string {
	// TODO : safe to ignore the error completely?
	data, _ := json.Marshal(query)
	return string(data)
}

func (query *searchQuery) processResource() {
	if query.Resource != nil {
		query.Scope = query.Resource.Scope()
	}
}

// processIDToken verifies the id token is legit and extracts its subject in the query.NamespacedID.
func (query *searchQuery) processIDToken(c *searchClientImpl) error {
	if query.IdToken != "" {
		claims, err := c.verifier.Verify(context.Background(), query.IdToken)
		if err != nil {
			return fmt.Errorf("%v: %w", ErrInvalidIDToken, err)
		}
		if claims.Subject == "" {
			return fmt.Errorf("%v: %w", ErrInvalidIDToken, errors.New("missing subject (namespacedID) in id token"))
		}
		query.NamespacedID = claims.Subject
		if !strings.HasPrefix(query.NamespacedID, NamespaceServiceAccount) && !strings.HasPrefix(query.NamespacedID, NamespaceUser) {
			// return an error if we attempt to query an `api-key` - currently not supported by the /search endpoint
			return ErrInvalidTokenNamespace
		}
	}
	return nil
}

// validateQuery checks if the query is valid.
func (query *searchQuery) validateQuery() error {
	// Validate inputs
	if (query.ActionPrefix != "") && (query.Action != "") {
		return fmt.Errorf("%w: %v", ErrInvalidQuery,
			"'action' and 'actionPrefix' are mutually exclusive")
	}
	if query.NamespacedID == "" && query.ActionPrefix == "" && query.Action == "" {
		return fmt.Errorf("%w: %v", ErrInvalidQuery,
			"at least one search option must be provided")
	}
	return nil
}

// Search returns the permissions for the given query.
func (c *searchClientImpl) Search(ctx context.Context, query searchQuery) (*searchResponse, error) {
	// set scope if resource is provided
	query.processResource()

	// set namespaced ID if id token is provided
	if err := query.processIDToken(c); err != nil {
		return nil, err
	}

	// validate query
	if err := query.validateQuery(); err != nil {
		return nil, err
	}

	key := searchCacheKey(query)

	item, err := c.cache.Get(ctx, key)
	if err != nil && !errors.Is(err, cache.ErrNotFound) {
		return nil, err
	}

	if err == nil {
		perms := permissionsByID{}
		err := gob.NewDecoder(bytes.NewReader(item)).Decode(&perms)
		if err != nil {
			return nil, fmt.Errorf("failed to decode cache entry: %w", err)
		} else {
			return &searchResponse{Data: &perms}, nil
		}
	}

	res, err, _ := c.singlef.Do(key, func() (interface{}, error) {
		v, _ := goquery.Values(query)
		url := strings.TrimRight(c.cfg.APIURL, "/") + searchPath + "?" + v.Encode()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, strings.NewReader(key))
		if err != nil {
			return nil, err
		}

		req.Header.Set("Authorization", "Bearer "+c.cfg.Token)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")

		res, err := c.client.Do(req)
		if err != nil {
			return nil, err
		}

		defer func() { _ = res.Body.Close() }()

		if res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden {
			return nil, ErrInvalidToken
		}

		if res.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("%w: %s", ErrUnexpectedStatus, res.Status)
		}

		response := permissionsByID{}
		if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
			return nil, fmt.Errorf("%w: %s", ErrInvalidResponse, err)
		}
		return response, nil
	})

	if err != nil {
		return nil, err
	}

	perms := res.(permissionsByID)
	if err := c.cacheValue(ctx, perms, key); err != nil {
		return nil, fmt.Errorf("failed to cache response: %w", err)
	}

	return &searchResponse{Data: &perms}, nil
}

func (c *searchClientImpl) cacheValue(ctx context.Context, perms permissionsByID, key string) error {
	buf := bytes.Buffer{}
	err := gob.NewEncoder(&buf).Encode(perms)
	if err != nil {
		return err
	}

	// Cache with default expiry
	return c.cache.Set(ctx, key, buf.Bytes(), cache.DefaultExpiration)
}
