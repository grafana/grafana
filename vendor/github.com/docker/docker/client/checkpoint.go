package client // import "github.com/docker/docker/client"

import (
	"context"

	"github.com/docker/docker/api/types/checkpoint"
)

// CheckpointAPIClient defines API client methods for the checkpoints.
//
// Experimental: checkpoint and restore is still an experimental feature,
// and only available if the daemon is running with experimental features
// enabled.
type CheckpointAPIClient interface {
	CheckpointCreate(ctx context.Context, container string, options checkpoint.CreateOptions) error
	CheckpointDelete(ctx context.Context, container string, options checkpoint.DeleteOptions) error
	CheckpointList(ctx context.Context, container string, options checkpoint.ListOptions) ([]checkpoint.Summary, error)
}
