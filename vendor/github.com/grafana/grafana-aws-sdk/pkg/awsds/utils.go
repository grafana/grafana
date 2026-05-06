package awsds

import (
	"fmt"
	"os"
	"runtime"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/build"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ShouldCacheQuery checks whether resp contains a running query, and returns false if it does
func ShouldCacheQuery(resp *backend.QueryDataResponse) bool {
	if resp == nil {
		return true
	}

	shouldCache := true
	for _, response := range resp.Responses {
		for _, frame := range response.Frames {
			if frame.Meta != nil && frame.Meta.Custom != nil {
				// If the response doesn't contain a status, it isn't an async query
				meta, ok := frame.Meta.Custom.(map[string]interface{})
				if !ok {
					continue
				}

				if meta["status"] == nil {
					continue
				}
				metaStatus, ok := meta["status"].(string)
				if !ok {
					continue
				}

				// we should not cache running queries
				if metaStatus == QueryRunning.String() || metaStatus == QuerySubmitted.String() {
					shouldCache = false
					break
				}
			}
		}
	}
	return shouldCache
}

// GetUserAgentString returns an agent that can be parsed in server logs
func GetUserAgentString(name string) string {
	// Build info is set from compile time flags
	buildInfo, err := build.GetBuildInfo()
	if err != nil {
		buildInfo.Version = "dev"
	}

	grafanaVersion := os.Getenv("GF_VERSION")
	if grafanaVersion == "" {
		grafanaVersion = "?"
	}

	// Determine if running in an Amazon Managed Grafana environment
	_, amgEnv := os.LookupEnv("AMAZON_MANAGED_GRAFANA")

	return fmt.Sprintf("%s/%s (%s; %s;) %s/%s Grafana/%s AMG/%s",
		aws.SDKName,
		aws.SDKVersion,
		runtime.Version(),
		runtime.GOOS,
		name,
		buildInfo.Version,
		grafanaVersion,
		strconv.FormatBool(amgEnv))
}

// getErrorFrameFromQuery returns a error frames with empty data and meta fields
func getErrorFrameFromQuery(query *AsyncQuery) data.Frames {
	frames := data.Frames{}
	frame := data.NewFrame(query.RefID)
	frame.Meta = &data.FrameMeta{
		ExecutedQueryString: query.RawSQL,
	}
	frames = append(frames, frame)
	return frames
}
