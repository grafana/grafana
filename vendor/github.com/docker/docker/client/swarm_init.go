package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/json"

	"github.com/docker/docker/api/types/swarm"
)

// SwarmInit initializes the swarm.
func (cli *Client) SwarmInit(ctx context.Context, req swarm.InitRequest) (string, error) {
	resp, err := cli.post(ctx, "/swarm/init", nil, req, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return "", err
	}

	var response string
	err = json.NewDecoder(resp.Body).Decode(&response)
	return response, err
}
