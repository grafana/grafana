package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/docker/docker/api/types/image"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

// ImageHistoryWithPlatform sets the platform for the image history operation.
func ImageHistoryWithPlatform(platform ocispec.Platform) ImageHistoryOption {
	return imageHistoryOptionFunc(func(opt *imageHistoryOpts) error {
		if opt.apiOptions.Platform != nil {
			return fmt.Errorf("platform already set to %s", *opt.apiOptions.Platform)
		}
		opt.apiOptions.Platform = &platform
		return nil
	})
}

// ImageHistory returns the changes in an image in history format.
func (cli *Client) ImageHistory(ctx context.Context, imageID string, historyOpts ...ImageHistoryOption) ([]image.HistoryResponseItem, error) {
	query := url.Values{}

	var opts imageHistoryOpts
	for _, o := range historyOpts {
		if err := o.Apply(&opts); err != nil {
			return nil, err
		}
	}

	if opts.apiOptions.Platform != nil {
		if err := cli.NewVersionError(ctx, "1.48", "platform"); err != nil {
			return nil, err
		}

		p, err := encodePlatform(opts.apiOptions.Platform)
		if err != nil {
			return nil, err
		}
		query.Set("platform", p)
	}

	resp, err := cli.get(ctx, "/images/"+imageID+"/history", query, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return nil, err
	}

	var history []image.HistoryResponseItem
	err = json.NewDecoder(resp.Body).Decode(&history)
	return history, err
}
