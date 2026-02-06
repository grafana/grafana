package container

import "github.com/docker/docker/api/types/common"

// CommitResponse response for the commit API call, containing the ID of the
// image that was produced.
type CommitResponse = common.IDResponse
