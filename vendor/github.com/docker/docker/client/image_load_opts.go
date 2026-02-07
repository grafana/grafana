package client

import (
	"fmt"

	"github.com/docker/docker/api/types/image"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

// ImageLoadOption is a type representing functional options for the image load operation.
type ImageLoadOption interface {
	Apply(*imageLoadOpts) error
}
type imageLoadOptionFunc func(opt *imageLoadOpts) error

func (f imageLoadOptionFunc) Apply(o *imageLoadOpts) error {
	return f(o)
}

type imageLoadOpts struct {
	apiOptions image.LoadOptions
}

// ImageLoadWithQuiet sets the quiet option for the image load operation.
func ImageLoadWithQuiet(quiet bool) ImageLoadOption {
	return imageLoadOptionFunc(func(opt *imageLoadOpts) error {
		opt.apiOptions.Quiet = quiet
		return nil
	})
}

// ImageLoadWithPlatforms sets the platforms to be loaded from the image.
func ImageLoadWithPlatforms(platforms ...ocispec.Platform) ImageLoadOption {
	return imageLoadOptionFunc(func(opt *imageLoadOpts) error {
		if opt.apiOptions.Platforms != nil {
			return fmt.Errorf("platforms already set to %v", opt.apiOptions.Platforms)
		}
		opt.apiOptions.Platforms = platforms
		return nil
	})
}
