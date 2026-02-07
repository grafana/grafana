package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
)

// VolumesPrune requests the daemon to delete unused data
func (cli *Client) VolumesPrune(ctx context.Context, pruneFilters filters.Args) (volume.PruneReport, error) {
	if err := cli.NewVersionError(ctx, "1.25", "volume prune"); err != nil {
		return volume.PruneReport{}, err
	}

	query, err := getFiltersQuery(pruneFilters)
	if err != nil {
		return volume.PruneReport{}, err
	}

	resp, err := cli.post(ctx, "/volumes/prune", query, nil, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return volume.PruneReport{}, err
	}

	var report volume.PruneReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return volume.PruneReport{}, fmt.Errorf("Error retrieving volume prune report: %v", err)
	}

	return report, nil
}
