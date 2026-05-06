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
	tokenCache = oauthTokenCacheType{
		cache: map[string]*oauth2.Token{},
	}

	// timeNow makes it possible to test usage of time
	timeNow = time.Now
)

type oauthTokenCacheType struct {
	cache map[string]*oauth2.Token
	sync.Mutex
}

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
	tokenSource
}

// GetAccessToken implements TokenProvider
func (provider *tokenProviderImpl) GetAccessToken(ctx context.Context) (string, error) {
	tokenCache.Lock()
	defer tokenCache.Unlock()
	if cachedToken, found := tokenCache.cache[provider.getCacheKey()]; found {
		if cachedToken.Expiry.After(timeNow().Add(time.Second * 10)) {
			return cachedToken.AccessToken, nil
		}
	}
	token, err := provider.getToken(ctx)
	if err != nil {
		return "", err
	}

	tokenCache.cache[provider.getCacheKey()] = token
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
