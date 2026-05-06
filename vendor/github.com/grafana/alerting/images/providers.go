package images

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/alerting/models"
)

// ErrImageUploadNotSupported is returned when image uploading is not supported.
var ErrImageUploadNotSupported = errors.New("image upload is not supported")

type UnavailableProvider struct{}

var _ Provider = (*UnavailableProvider)(nil)

func (u *UnavailableProvider) GetImage(_ context.Context, _ types.Alert) (*Image, error) {
	return nil, ErrImagesUnavailable
}

// URLProvider is a provider that stores a direct reference to an image's public URL in an alert's annotations.
// The URL is not validated against a database record, so retrieving raw image data is blocked in an attempt
// to prevent malicious access to untrusted URLs.
type URLProvider struct{}

var _ Provider = (*URLProvider)(nil)

// GetImage returns the image associated with a given alert.
// The URL should be treated as untrusted and notifiers should pass the URL directly without attempting to download
// the image data.
func (u *URLProvider) GetImage(_ context.Context, alert types.Alert) (*Image, error) {
	url := GetImageURL(alert)
	if url == "" {
		return nil, nil
	}

	return &Image{
		ID:  url,
		URL: url,
		RawData: func(_ context.Context) (ImageContent, error) {
			// Raw images are not available for URLs provided directly by annotations as the image data is non-local.
			// While it might be possible to download the image data, it's generally not safe to do so as the URL is
			// not guaranteed to be trusted.
			return ImageContent{}, fmt.Errorf("%w: URLProvider does not support raw image data", ErrImageUploadNotSupported)
		},
	}, nil
}

type TokenStore interface {
	GetImage(ctx context.Context, token string) (*Image, error)
}

// TokenProvider implements the ImageProvider interface, retrieving images from a store using tokens.
// Image data should be considered trusted as the stored image URL and content are not user-modifiable.
type TokenProvider struct {
	store  TokenStore
	logger log.Logger
}

var _ Provider = (*TokenProvider)(nil)

func NewTokenProvider(store TokenStore, logger log.Logger) Provider {
	return &TokenProvider{
		store:  store,
		logger: logger,
	}
}

func (i TokenProvider) GetImage(ctx context.Context, alert types.Alert) (*Image, error) {
	token := GetImageToken(alert)
	if token == "" {
		return nil, nil
	}

	// Assume the uri is a token because we used to store tokens as plain strings.
	level.Debug(i.logger).Log("msg", "received an image token in annotations", "token", token)
	image, err := i.store.GetImage(ctx, token)
	if err != nil {
		if errors.Is(err, ErrImageNotFound) {
			level.Info(i.logger).Log("msg", "image not found in database", "token", token)
			return nil, nil
		}
		return nil, err
	}

	return image, nil
}

// GetImageToken is a helper function to retrieve the image token from the alert annotations.
func GetImageToken(alert types.Alert) string {
	return string(alert.Annotations[models.ImageTokenAnnotation])
}

// GetImageURL is a helper function to retrieve the image url from the alert annotations.
func GetImageURL(alert types.Alert) string {
	return string(alert.Annotations[models.ImageURLAnnotation])
}
