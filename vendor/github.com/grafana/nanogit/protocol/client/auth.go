package client

import (
	"context"
	"fmt"
	"strings"
)

// IsAuthorized checks if the client can successfully communicate with the Git server.
// It performs a basic connectivity test by attempting to fetch the server's capabilities
// through the git-upload-pack service.
//
// Returns:
//   - true if the server is reachable and the client is authorized
//   - false if the server returns a 401 Unauthorized response
//   - error if there are any other connection or protocol issues
func (c *rawClient) IsAuthorized(ctx context.Context) (bool, error) {
	// First get the initial capability advertisement
	err := c.SmartInfo(ctx, "git-upload-pack")
	if err != nil {
		if strings.Contains(err.Error(), "401 Unauthorized") {
			return false, nil
		}
		return false, fmt.Errorf("get repository info: %w", err)
	}

	return true, nil
}
