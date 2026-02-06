package client // import "github.com/docker/docker/client"

import (
	"context"
	"io"
	"net/url"
	"strings"

	"github.com/distribution/reference"
	"github.com/docker/docker/api/types/image"
)

// ImageImport creates a new image based on the source options.
// It returns the JSON content in the response body.
func (cli *Client) ImageImport(ctx context.Context, source image.ImportSource, ref string, options image.ImportOptions) (io.ReadCloser, error) {
	if ref != "" {
		// Check if the given image name can be resolved
		if _, err := reference.ParseNormalizedNamed(ref); err != nil {
			return nil, err
		}
	}

	query := url.Values{}
	if source.SourceName != "" {
		query.Set("fromSrc", source.SourceName)
	}
	if ref != "" {
		query.Set("repo", ref)
	}
	if options.Tag != "" {
		query.Set("tag", options.Tag)
	}
	if options.Message != "" {
		query.Set("message", options.Message)
	}
	if options.Platform != "" {
		query.Set("platform", strings.ToLower(options.Platform))
	}
	for _, change := range options.Changes {
		query.Add("changes", change)
	}

	resp, err := cli.postRaw(ctx, "/images/create", query, source.Source, nil)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}
