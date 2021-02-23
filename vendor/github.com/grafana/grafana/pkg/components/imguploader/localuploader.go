package imguploader

import (
	"context"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/setting"
)

type LocalUploader struct {
}

func (u *LocalUploader) Upload(ctx context.Context, imageOnDiskPath string) (string, error) {
	filename := filepath.Base(imageOnDiskPath)
	image_url := setting.ToAbsUrl(path.Join("public/img/attachments", filename))
	return image_url, nil
}

func NewLocalImageUploader() (*LocalUploader, error) {
	return &LocalUploader{}, nil
}
