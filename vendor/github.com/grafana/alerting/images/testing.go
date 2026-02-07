package images

import (
	"context"
	"encoding/base64"
	"fmt"
	"testing"

	"github.com/go-kit/log"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/models"
)

type FakeTokenStore struct {
	Images map[string]*Image
}

var _ TokenStore = (*FakeTokenStore)(nil)

func (f FakeTokenStore) GetImage(_ context.Context, token string) (*Image, error) {
	return f.Images[token], nil
}

func NewFakeProvider(n int) Provider {
	return NewTokenProvider(NewFakeTokenStore(n), log.NewNopLogger())
}

func NewFakeProviderWithFile(t *testing.T, n int) Provider {
	return NewTokenProvider(NewFakeTokenStoreWithFile(t, n), log.NewNopLogger())
}

func NewFakeProviderWithStore(s TokenStore) Provider {
	return NewTokenProvider(s, log.NewNopLogger())
}

func NewFakeTokenStoreFromImages(images map[string]*Image) *FakeTokenStore {
	return &FakeTokenStore{Images: images}
}

// NewFakeTokenStore returns an token store with N test images.
// Each image has a URL, but does not have a file on disk.
// They are mapped to the token test-image-%d
func NewFakeTokenStore(n int) *FakeTokenStore {
	p := FakeTokenStore{
		Images: make(map[string]*Image),
	}
	for i := 1; i <= n; i++ {
		token := fmt.Sprintf("test-image-%d", i)
		p.Images[token] = &Image{
			ID:  token,
			URL: fmt.Sprintf("https://www.example.com/test-image-%d.jpg", i),
			RawData: func(_ context.Context) (ImageContent, error) {
				return ImageContent{}, ErrImagesUnavailable
			},
		}
	}
	return &p
}

// NewFakeTokenStoreWithFile returns an image provider with N test images.
// Each image has a URL and raw data.
// They are mapped to the token test-image-%d
func NewFakeTokenStoreWithFile(t *testing.T, n int) *FakeTokenStore {
	p := FakeTokenStore{
		Images: make(map[string]*Image),
	}
	// 1x1 transparent PNG
	b, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
	if err != nil {
		t.Fatalf("failed to decode PNG data: %s", err)
	}

	for i := 1; i <= n; i++ {
		token := fmt.Sprintf("test-image-%d", i)
		p.Images[token] = &Image{
			ID: token,
			RawData: func(_ context.Context) (ImageContent, error) {
				return ImageContent{
					Name:    fmt.Sprintf("test-image-%d.jpg", i),
					Content: b,
				}, nil
			},
		}
	}
	return &p
}

func newAlertWithImageURL(url string) types.Alert {
	return types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ImageURLAnnotation: model.LabelValue(url),
			},
		},
	}
}

func newAlertWithImageToken(token string) types.Alert {
	return types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ImageTokenAnnotation: model.LabelValue(token),
			},
		},
	}
}
