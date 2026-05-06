package aztokenprovider

import (
	"context"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/grpc/metadata"
)

const grafanaTenantId = "tenantID"

var (
	// timeNow makes it possible to test usage of time
	timeNow = time.Now
)

type AccessToken struct {
	Token     string
	ExpiresOn time.Time
}

type TokenRetriever interface {
	GetCacheKey(grafanaMultiTenantId string) string
	Init() error
	GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error)
	GetExpiry() *time.Time
}

type ConcurrentTokenCache interface {
	GetAccessToken(ctx context.Context, tokenRetriever TokenRetriever, scopes []string) (string, error)
}

func NewConcurrentTokenCache() ConcurrentTokenCache {
	return &tokenCacheImpl{}
}

type tokenCacheImpl struct {
	cache sync.Map // of *credentialCacheEntry
}
type credentialCacheEntry struct {
	retriever TokenRetriever
	expiry    *time.Time

	credInit  uint32
	credMutex sync.Mutex
	cache     sync.Map // of *scopesCacheEntry
}

type scopesCacheEntry struct {
	retriever TokenRetriever
	scopes    []string

	cond        *sync.Cond
	refreshing  bool
	accessToken *AccessToken
}

func (c *tokenCacheImpl) GetAccessToken(ctx context.Context, tokenRetriever TokenRetriever, scopes []string) (string, error) {
	return c.getEntryFor(ctx, tokenRetriever).getAccessToken(ctx, scopes)
}

func (c *tokenCacheImpl) getEntryFor(ctx context.Context, credential TokenRetriever) *credentialCacheEntry {
	var entry interface{}
	var ok bool
	tid := returnGrafanaMultiTenantId(ctx)

	key := credential.GetCacheKey(tid)

	entry, ok = c.cache.Load(key)
	// Store new cache value if there isn't an existing one
	if !ok {
		entry, _ = c.cache.LoadOrStore(key, &credentialCacheEntry{
			retriever: credential,
		})
		return entry.(*credentialCacheEntry)
	}

	expiry := entry.(*credentialCacheEntry).retriever.GetExpiry()
	// Store new cache value if the current one has expired (only applies to OBO retriever)
	if expiry != nil && !expiry.After(time.Now()) {
		c.cache.Store(key, &credentialCacheEntry{
			retriever: credential,
		})
		entry, _ = c.cache.Load(key)
	}

	return entry.(*credentialCacheEntry)
}

func (c *credentialCacheEntry) getAccessToken(ctx context.Context, scopes []string) (string, error) {
	err := c.ensureInitialized()
	if err != nil {
		return "", err
	}

	return c.getEntryFor(scopes).getAccessToken(ctx)
}

func (c *credentialCacheEntry) ensureInitialized() error {
	if atomic.LoadUint32(&c.credInit) == 0 {
		c.credMutex.Lock()
		defer c.credMutex.Unlock()

		if c.credInit == 0 {
			// Initialize retriever
			err := c.retriever.Init()
			if err != nil {
				return err
			}

			atomic.StoreUint32(&c.credInit, 1)
		}
	}

	return nil
}

func (c *credentialCacheEntry) getEntryFor(scopes []string) *scopesCacheEntry {
	var entry interface{}
	var ok bool

	key := getKeyForScopes(scopes)

	if entry, ok = c.cache.Load(key); !ok {
		entry, _ = c.cache.LoadOrStore(key, &scopesCacheEntry{
			retriever: c.retriever,
			scopes:    scopes,
			cond:      sync.NewCond(&sync.Mutex{}),
		})
	}

	return entry.(*scopesCacheEntry)
}

func (c *scopesCacheEntry) getAccessToken(ctx context.Context) (string, error) {
	var accessToken *AccessToken
	var err error
	shouldRefresh := false

	c.cond.L.Lock()
	for {
		if c.accessToken != nil && c.accessToken.ExpiresOn.After(timeNow().Add(2*time.Minute)) {
			// Use the cached token since it's available and not expired yet
			accessToken = c.accessToken
			break
		}

		if !c.refreshing {
			// Start refreshing the token
			c.refreshing = true
			shouldRefresh = true
			break
		}

		// Wait for the token to be refreshed
		c.cond.Wait()
	}
	c.cond.L.Unlock()

	if shouldRefresh {
		accessToken, err = c.refreshAccessToken(ctx)
		if err != nil {
			return "", err
		}
	}

	return accessToken.Token, nil
}

func (c *scopesCacheEntry) refreshAccessToken(ctx context.Context) (*AccessToken, error) {
	var accessToken *AccessToken

	// Safeguarding from panic caused by retriever implementation
	defer func() {
		c.cond.L.Lock()

		c.refreshing = false

		if accessToken != nil {
			c.accessToken = accessToken
		}

		c.cond.Broadcast()
		c.cond.L.Unlock()
	}()

	token, err := c.retriever.GetAccessToken(ctx, c.scopes)
	if err != nil {
		return nil, err
	}
	accessToken = token
	return accessToken, nil
}

func getKeyForScopes(scopes []string) string {
	if len(scopes) > 1 {
		arr := make([]string, len(scopes))
		copy(arr, scopes)
		sort.Strings(arr)
		scopes = arr
	}

	return strings.Join(scopes, " ")
}

func returnGrafanaMultiTenantId(ctx context.Context) (grafanaMultiTenantId string) {
	md, exists := metadata.FromIncomingContext(ctx)

	if exists {
		tid := md.Get(grafanaTenantId)
		if len(tid) > 0 && tid[0] != "" {
			grafanaMultiTenantId = tid[0]
		}
	}

	return grafanaMultiTenantId
}
