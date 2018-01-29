// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	MaxImageSize = 6048 * 4032 // 24 megapixels, roughly 36MB as a raw image
)

var (
	IMAGE_EXTENSIONS = [5]string{".jpg", ".jpeg", ".gif", ".bmp", ".png"}
	IMAGE_MIME_TYPES = map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".png": "image/png", ".tiff": "image/tiff"}
)

type FileUploadResponse struct {
	FileInfos []*FileInfo `json:"file_infos"`
	ClientIds []string    `json:"client_ids"`
}

func FileUploadResponseFromJson(data io.Reader) *FileUploadResponse {
	decoder := json.NewDecoder(data)
	var o FileUploadResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *FileUploadResponse) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}
