package aztokenprovider

import (
	"context"
	"fmt"
	"time"
)

type usernameTokenRetriever struct {
	client   TokenClient
	username string
}

func (r *usernameTokenRetriever) GetCacheKey(grafanaMultiTenantId string) string {
	return fmt.Sprintf("currentuser|username|%s|%s", r.username, grafanaMultiTenantId)
}

func (r *usernameTokenRetriever) Init() error {
	// Nothing to initialize
	return nil
}

func (r *usernameTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := r.client.FromUsername(ctx, r.username, scopes)
	if err != nil {
		return nil, err
	}

	return accessToken, nil
}

// Empty implementation
func (c *usernameTokenRetriever) GetExpiry() *time.Time {
	return nil
}
