package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
)

// ContainersPrune requests the daemon to delete unused data
func (cli *Client) ContainersPrune(ctx context.Context, pruneFilters filters.Args) (container.PruneReport, error) {
	if err := cli.NewVersionError(ctx, "1.25", "container prune"); err != nil {
		return container.PruneReport{}, err
	}

	query, err := getFiltersQuery(pruneFilters)
	if err != nil {
		return container.PruneReport{}, err
	}

	resp, err := cli.post(ctx, "/containers/prune", query, nil, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return container.PruneReport{}, err
	}

	var report container.PruneReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return container.PruneReport{}, fmt.Errorf("Error retrieving disk usage: %v", err)
	}

	return report, nil
}
