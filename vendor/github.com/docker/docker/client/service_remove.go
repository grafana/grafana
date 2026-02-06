package client // import "github.com/docker/docker/client"

import "context"

// ServiceRemove kills and removes a service.
func (cli *Client) ServiceRemove(ctx context.Context, serviceID string) error {
	serviceID, err := trimID("service", serviceID)
	if err != nil {
		return err
	}

	resp, err := cli.delete(ctx, "/services/"+serviceID, nil, nil)
	defer ensureReaderClosed(resp)
	return err
}
