package client // import "github.com/docker/docker/client"

import (
	"context"

	"github.com/docker/docker/api/types/checkpoint"
)

// CheckpointCreate creates a checkpoint from the given container with the given name
func (cli *Client) CheckpointCreate(ctx context.Context, containerID string, options checkpoint.CreateOptions) error {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return err
	}

	resp, err := cli.post(ctx, "/containers/"+containerID+"/checkpoints", nil, options, nil)
	ensureReaderClosed(resp)
	return err
}
