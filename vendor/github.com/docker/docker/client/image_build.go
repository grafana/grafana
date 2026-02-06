package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
)

// ImageBuild sends a request to the daemon to build images.
// The Body in the response implements an io.ReadCloser and it's up to the caller to
// close it.
func (cli *Client) ImageBuild(ctx context.Context, buildContext io.Reader, options types.ImageBuildOptions) (types.ImageBuildResponse, error) {
	query, err := cli.imageBuildOptionsToQuery(ctx, options)
	if err != nil {
		return types.ImageBuildResponse{}, err
	}

	buf, err := json.Marshal(options.AuthConfigs)
	if err != nil {
		return types.ImageBuildResponse{}, err
	}

	headers := http.Header{}
	headers.Add("X-Registry-Config", base64.URLEncoding.EncodeToString(buf))
	headers.Set("Content-Type", "application/x-tar")

	resp, err := cli.postRaw(ctx, "/build", query, buildContext, headers)
	if err != nil {
		return types.ImageBuildResponse{}, err
	}

	return types.ImageBuildResponse{
		Body:   resp.Body,
		OSType: getDockerOS(resp.Header.Get("Server")),
	}, nil
}

func (cli *Client) imageBuildOptionsToQuery(ctx context.Context, options types.ImageBuildOptions) (url.Values, error) {
	query := url.Values{}
	if len(options.Tags) > 0 {
		query["t"] = options.Tags
	}
	if len(options.SecurityOpt) > 0 {
		query["securityopt"] = options.SecurityOpt
	}
	if len(options.ExtraHosts) > 0 {
		query["extrahosts"] = options.ExtraHosts
	}
	if options.SuppressOutput {
		query.Set("q", "1")
	}
	if options.RemoteContext != "" {
		query.Set("remote", options.RemoteContext)
	}
	if options.NoCache {
		query.Set("nocache", "1")
	}
	if !options.Remove {
		// only send value when opting out because the daemon's default is
		// to remove intermediate containers after a successful build,
		//
		// TODO(thaJeztah): deprecate "Remove" option, and provide a "NoRemove" or "Keep" option instead.
		query.Set("rm", "0")
	}

	if options.ForceRemove {
		query.Set("forcerm", "1")
	}

	if options.PullParent {
		query.Set("pull", "1")
	}

	if options.Squash {
		if err := cli.NewVersionError(ctx, "1.25", "squash"); err != nil {
			return query, err
		}
		query.Set("squash", "1")
	}

	if !container.Isolation.IsDefault(options.Isolation) {
		query.Set("isolation", string(options.Isolation))
	}

	if options.CPUSetCPUs != "" {
		query.Set("cpusetcpus", options.CPUSetCPUs)
	}
	if options.NetworkMode != "" && options.NetworkMode != network.NetworkDefault {
		query.Set("networkmode", options.NetworkMode)
	}
	if options.CPUSetMems != "" {
		query.Set("cpusetmems", options.CPUSetMems)
	}
	if options.CPUShares != 0 {
		query.Set("cpushares", strconv.FormatInt(options.CPUShares, 10))
	}
	if options.CPUQuota != 0 {
		query.Set("cpuquota", strconv.FormatInt(options.CPUQuota, 10))
	}
	if options.CPUPeriod != 0 {
		query.Set("cpuperiod", strconv.FormatInt(options.CPUPeriod, 10))
	}
	if options.Memory != 0 {
		query.Set("memory", strconv.FormatInt(options.Memory, 10))
	}
	if options.MemorySwap != 0 {
		query.Set("memswap", strconv.FormatInt(options.MemorySwap, 10))
	}
	if options.CgroupParent != "" {
		query.Set("cgroupparent", options.CgroupParent)
	}
	if options.ShmSize != 0 {
		query.Set("shmsize", strconv.FormatInt(options.ShmSize, 10))
	}
	if options.Dockerfile != "" {
		query.Set("dockerfile", options.Dockerfile)
	}
	if options.Target != "" {
		query.Set("target", options.Target)
	}
	if len(options.Ulimits) != 0 {
		ulimitsJSON, err := json.Marshal(options.Ulimits)
		if err != nil {
			return query, err
		}
		query.Set("ulimits", string(ulimitsJSON))
	}
	if len(options.BuildArgs) != 0 {
		buildArgsJSON, err := json.Marshal(options.BuildArgs)
		if err != nil {
			return query, err
		}
		query.Set("buildargs", string(buildArgsJSON))
	}
	if len(options.Labels) != 0 {
		labelsJSON, err := json.Marshal(options.Labels)
		if err != nil {
			return query, err
		}
		query.Set("labels", string(labelsJSON))
	}
	if len(options.CacheFrom) != 0 {
		cacheFromJSON, err := json.Marshal(options.CacheFrom)
		if err != nil {
			return query, err
		}
		query.Set("cachefrom", string(cacheFromJSON))
	}
	if options.SessionID != "" {
		query.Set("session", options.SessionID)
	}
	if options.Platform != "" {
		if err := cli.NewVersionError(ctx, "1.32", "platform"); err != nil {
			return query, err
		}
		query.Set("platform", strings.ToLower(options.Platform))
	}
	if options.BuildID != "" {
		query.Set("buildid", options.BuildID)
	}
	if options.Version != "" {
		query.Set("version", string(options.Version))
	}

	if options.Outputs != nil {
		outputsJSON, err := json.Marshal(options.Outputs)
		if err != nil {
			return query, err
		}
		query.Set("outputs", string(outputsJSON))
	}
	return query, nil
}
