package imagedata

import (
	"fmt"
	"io"

	"github.com/gophercloud/gophercloud"
)

// UploadResult is the result of an upload image operation
type UploadResult struct {
	gophercloud.ErrResult
}

// DownloadResult is the result of a download image operation
type DownloadResult struct {
	gophercloud.Result
}

// Extract builds images model from io.Reader
func (r DownloadResult) Extract() (io.Reader, error) {
	if r, ok := r.Body.(io.Reader); ok {
		return r, nil
	}
	return nil, fmt.Errorf("Expected io.Reader but got: %T(%#v)", r.Body, r.Body)
}
