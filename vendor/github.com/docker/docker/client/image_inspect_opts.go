package client

import (
	"bytes"

	"github.com/docker/docker/api/types/image"
)

// ImageInspectOption is a type representing functional options for the image inspect operation.
type ImageInspectOption interface {
	Apply(*imageInspectOpts) error
}
type imageInspectOptionFunc func(opt *imageInspectOpts) error

func (f imageInspectOptionFunc) Apply(o *imageInspectOpts) error {
	return f(o)
}

// ImageInspectWithRawResponse instructs the client to additionally store the
// raw inspect response in the provided buffer.
func ImageInspectWithRawResponse(raw *bytes.Buffer) ImageInspectOption {
	return imageInspectOptionFunc(func(opts *imageInspectOpts) error {
		opts.raw = raw
		return nil
	})
}

// ImageInspectWithManifests sets manifests API option for the image inspect operation.
// This option is only available for API version 1.48 and up.
// With this option set, the image inspect operation response will have the
// [image.InspectResponse.Manifests] field populated if the server is multi-platform capable.
func ImageInspectWithManifests(manifests bool) ImageInspectOption {
	return imageInspectOptionFunc(func(clientOpts *imageInspectOpts) error {
		clientOpts.apiOptions.Manifests = manifests
		return nil
	})
}

// ImageInspectWithAPIOpts sets the API options for the image inspect operation.
func ImageInspectWithAPIOpts(opts image.InspectOptions) ImageInspectOption {
	return imageInspectOptionFunc(func(clientOpts *imageInspectOpts) error {
		clientOpts.apiOptions = opts
		return nil
	})
}

type imageInspectOpts struct {
	raw        *bytes.Buffer
	apiOptions image.InspectOptions
}
