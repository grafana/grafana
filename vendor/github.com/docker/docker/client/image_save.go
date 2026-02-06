package client // import "github.com/docker/docker/client"

import (
	"context"
	"io"
	"net/url"
)

// ImageSave retrieves one or more images from the docker host as an io.ReadCloser.
//
// Platforms is an optional parameter that specifies the platforms to save from the image.
// This is only has effect if the input image is a multi-platform image.
func (cli *Client) ImageSave(ctx context.Context, imageIDs []string, saveOpts ...ImageSaveOption) (io.ReadCloser, error) {
	var opts imageSaveOpts
	for _, opt := range saveOpts {
		if err := opt.Apply(&opts); err != nil {
			return nil, err
		}
	}

	query := url.Values{
		"names": imageIDs,
	}

	if len(opts.apiOptions.Platforms) > 0 {
		if err := cli.NewVersionError(ctx, "1.48", "platform"); err != nil {
			return nil, err
		}
		p, err := encodePlatforms(opts.apiOptions.Platforms...)
		if err != nil {
			return nil, err
		}
		query["platform"] = p
	}

	resp, err := cli.get(ctx, "/images/get", query, nil)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}
