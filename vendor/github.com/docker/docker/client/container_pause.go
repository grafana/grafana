package client // import "github.com/docker/docker/client"

import "context"

// ContainerPause pauses the main process of a given container without terminating it.
func (cli *Client) ContainerPause(ctx context.Context, containerID string) error {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return err
	}

	resp, err := cli.post(ctx, "/containers/"+containerID+"/pause", nil, nil, nil)
	ensureReaderClosed(resp)
	return err
}
