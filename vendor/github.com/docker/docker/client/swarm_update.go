package client // import "github.com/docker/docker/client"

import (
	"context"
	"net/url"
	"strconv"

	"github.com/docker/docker/api/types/swarm"
)

// SwarmUpdate updates the swarm.
func (cli *Client) SwarmUpdate(ctx context.Context, version swarm.Version, swarm swarm.Spec, flags swarm.UpdateFlags) error {
	query := url.Values{}
	query.Set("version", version.String())
	query.Set("rotateWorkerToken", strconv.FormatBool(flags.RotateWorkerToken))
	query.Set("rotateManagerToken", strconv.FormatBool(flags.RotateManagerToken))
	query.Set("rotateManagerUnlockKey", strconv.FormatBool(flags.RotateManagerUnlockKey))
	resp, err := cli.post(ctx, "/swarm/update", query, swarm, nil)
	ensureReaderClosed(resp)
	return err
}
