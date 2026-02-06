package tokenprovider

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
)

var (
	// timeNow makes it possible to test usage of time
	timeNow = time.Now
)

// TokenProvider is anything that can return a token
type TokenProvider interface {
	GetAccessToken(context.Context) (string, error)
}

type tokenSource interface {
	getCacheKey() string
	getToken(context.Context) (*oauth2.Token, error)
}

// tokenProviderImpl implements the TokenProvider interface
type tokenProviderImpl struct {
	tokenSource tokenSource
	cache       map[string]oauth2.Token
	cacheLock   sync.RWMutex
}

// GetAccessToken implements TokenProvider
func (provider *tokenProviderImpl) GetAccessToken(ctx context.Context) (string, error) {
	providerCacheKey := provider.tokenSource.getCacheKey()

	provider.cacheLock.RLock()
	cachedToken, found := provider.cache[providerCacheKey]
	provider.cacheLock.RUnlock()
	if found {
		if cachedToken.Expiry.After(timeNow().Add(time.Second * 10)) {
			return cachedToken.AccessToken, nil
		}
	}

	provider.cacheLock.Lock()
	defer provider.cacheLock.Unlock()

	token, err := provider.tokenSource.getToken(ctx)
	if err != nil {
		return "", err
	}

	provider.cache[providerCacheKey] = *token
	return token.AccessToken, nil
}

func createCacheKey(authtype string, cfg *Config) string {
	key := fmt.Sprintf("%v_%v_%v_%v_%v", authtype, cfg.DataSourceID, cfg.DataSourceUpdated.Unix(), cfg.RoutePath, cfg.RouteMethod)
	if len(cfg.Scopes) == 0 {
		return key
	}

	arr := make([]string, len(cfg.Scopes))
	copy(arr, cfg.Scopes)
	sort.Strings(arr)
	return fmt.Sprintf("%v_%v", key, strings.Join(arr, "-"))
}
