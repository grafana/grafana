package client

import (
	"github.com/docker/docker/api/types/image"
)

// ImageHistoryOption is a type representing functional options for the image history operation.
type ImageHistoryOption interface {
	Apply(*imageHistoryOpts) error
}
type imageHistoryOptionFunc func(opt *imageHistoryOpts) error

func (f imageHistoryOptionFunc) Apply(o *imageHistoryOpts) error {
	return f(o)
}

type imageHistoryOpts struct {
	apiOptions image.HistoryOptions
}
