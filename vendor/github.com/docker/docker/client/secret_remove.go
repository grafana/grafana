package client // import "github.com/docker/docker/client"

import "context"

// SecretRemove removes a secret.
func (cli *Client) SecretRemove(ctx context.Context, id string) error {
	id, err := trimID("secret", id)
	if err != nil {
		return err
	}
	if err := cli.NewVersionError(ctx, "1.25", "secret remove"); err != nil {
		return err
	}
	resp, err := cli.delete(ctx, "/secrets/"+id, nil, nil)
	defer ensureReaderClosed(resp)
	return err
}
