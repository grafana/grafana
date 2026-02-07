package client

import (
	"fmt"

	"github.com/docker/docker/api/types/image"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

type ImageSaveOption interface {
	Apply(*imageSaveOpts) error
}

type imageSaveOptionFunc func(opt *imageSaveOpts) error

func (f imageSaveOptionFunc) Apply(o *imageSaveOpts) error {
	return f(o)
}

// ImageSaveWithPlatforms sets the platforms to be saved from the image.
func ImageSaveWithPlatforms(platforms ...ocispec.Platform) ImageSaveOption {
	return imageSaveOptionFunc(func(opt *imageSaveOpts) error {
		if opt.apiOptions.Platforms != nil {
			return fmt.Errorf("platforms already set to %v", opt.apiOptions.Platforms)
		}
		opt.apiOptions.Platforms = platforms
		return nil
	})
}

type imageSaveOpts struct {
	apiOptions image.SaveOptions
}
