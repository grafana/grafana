package client // import "github.com/docker/docker/client"

import (
	"context"
	"net/url"

	"github.com/docker/docker/api/types/container"
)

// ContainerStats returns near realtime stats for a given container.
// It's up to the caller to close the io.ReadCloser returned.
func (cli *Client) ContainerStats(ctx context.Context, containerID string, stream bool) (container.StatsResponseReader, error) {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return container.StatsResponseReader{}, err
	}

	query := url.Values{}
	query.Set("stream", "0")
	if stream {
		query.Set("stream", "1")
	}

	resp, err := cli.get(ctx, "/containers/"+containerID+"/stats", query, nil)
	if err != nil {
		return container.StatsResponseReader{}, err
	}

	return container.StatsResponseReader{
		Body:   resp.Body,
		OSType: getDockerOS(resp.Header.Get("Server")),
	}, nil
}

// ContainerStatsOneShot gets a single stat entry from a container.
// It differs from `ContainerStats` in that the API should not wait to prime the stats
func (cli *Client) ContainerStatsOneShot(ctx context.Context, containerID string) (container.StatsResponseReader, error) {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return container.StatsResponseReader{}, err
	}

	query := url.Values{}
	query.Set("stream", "0")
	query.Set("one-shot", "1")

	resp, err := cli.get(ctx, "/containers/"+containerID+"/stats", query, nil)
	if err != nil {
		return container.StatsResponseReader{}, err
	}

	return container.StatsResponseReader{
		Body:   resp.Body,
		OSType: getDockerOS(resp.Header.Get("Server")),
	}, nil
}
