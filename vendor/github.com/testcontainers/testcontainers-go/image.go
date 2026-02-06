package testcontainers

import (
	"context"
)

// ImageInfo represents summary information of an image
type ImageInfo struct {
	ID   string
	Name string
}

// ImageProvider allows manipulating images
type ImageProvider interface {
	ListImages(context.Context) ([]ImageInfo, error)
	SaveImages(context.Context, string, ...string) error
	PullImage(context.Context, string) error
}
