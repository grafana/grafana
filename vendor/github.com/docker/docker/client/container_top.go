package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"

	"github.com/docker/docker/api/types/container"
)

// ContainerTop shows process information from within a container.
func (cli *Client) ContainerTop(ctx context.Context, containerID string, arguments []string) (container.TopResponse, error) {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return container.TopResponse{}, err
	}

	query := url.Values{}
	if len(arguments) > 0 {
		query.Set("ps_args", strings.Join(arguments, " "))
	}

	resp, err := cli.get(ctx, "/containers/"+containerID+"/top", query, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return container.TopResponse{}, err
	}

	var response container.TopResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	return response, err
}
