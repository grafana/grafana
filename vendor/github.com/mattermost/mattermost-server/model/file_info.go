// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"image"
	"image/gif"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
)

type FileInfo struct {
	Id              string `json:"id"`
	CreatorId       string `json:"user_id"`
	PostId          string `json:"post_id,omitempty"`
	CreateAt        int64  `json:"create_at"`
	UpdateAt        int64  `json:"update_at"`
	DeleteAt        int64  `json:"delete_at"`
	Path            string `json:"-"` // not sent back to the client
	ThumbnailPath   string `json:"-"` // not sent back to the client
	PreviewPath     string `json:"-"` // not sent back to the client
	Name            string `json:"name"`
	Extension       string `json:"extension"`
	Size            int64  `json:"size"`
	MimeType        string `json:"mime_type"`
	Width           int    `json:"width,omitempty"`
	Height          int    `json:"height,omitempty"`
	HasPreviewImage bool   `json:"has_preview_image,omitempty"`
}

func (info *FileInfo) ToJson() string {
	b, err := json.Marshal(info)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func FileInfoFromJson(data io.Reader) *FileInfo {
	decoder := json.NewDecoder(data)

	var info FileInfo
	if err := decoder.Decode(&info); err != nil {
		return nil
	} else {
		return &info
	}
}

func FileInfosToJson(infos []*FileInfo) string {
	b, err := json.Marshal(infos)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func FileInfosFromJson(data io.Reader) []*FileInfo {
	decoder := json.NewDecoder(data)

	var infos []*FileInfo
	if err := decoder.Decode(&infos); err != nil {
		return nil
	} else {
		return infos
	}
}

func (o *FileInfo) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}

	if o.UpdateAt < o.CreateAt {
		o.UpdateAt = o.CreateAt
	}
}

func (o *FileInfo) IsValid() *AppError {
	if len(o.Id) != 26 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.CreatorId) != 26 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.user_id.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.PostId) != 0 && len(o.PostId) != 26 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.post_id.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Path == "" {
		return NewAppError("FileInfo.IsValid", "model.file_info.is_valid.path.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	return nil
}

func (o *FileInfo) IsImage() bool {
	return strings.HasPrefix(o.MimeType, "image")
}

func GetInfoForBytes(name string, data []byte) (*FileInfo, *AppError) {
	info := &FileInfo{
		Name: name,
		Size: int64(len(data)),
	}
	var err *AppError

	extension := strings.ToLower(filepath.Ext(name))
	info.MimeType = mime.TypeByExtension(extension)

	if extension != "" && extension[0] == '.' {
		// The client expects a file extension without the leading period
		info.Extension = extension[1:]
	} else {
		info.Extension = extension
	}

	if info.IsImage() {
		// Only set the width and height if it's actually an image that we can understand
		if config, _, err := image.DecodeConfig(bytes.NewReader(data)); err == nil {
			info.Width = config.Width
			info.Height = config.Height

			if info.MimeType == "image/gif" {
				// Just show the gif itself instead of a preview image for animated gifs
				if gifConfig, err := gif.DecodeAll(bytes.NewReader(data)); err != nil {
					// Still return the rest of the info even though it doesn't appear to be an actual gif
					info.HasPreviewImage = true
					err = NewAppError("GetInfoForBytes", "model.file_info.get.gif.app_error", nil, "name="+name, http.StatusBadRequest)
				} else {
					info.HasPreviewImage = len(gifConfig.Image) == 1
				}
			} else {
				info.HasPreviewImage = true
			}
		}
	}

	return info, err
}

func GetEtagForFileInfos(infos []*FileInfo) string {
	if len(infos) == 0 {
		return Etag()
	}

	var maxUpdateAt int64

	for _, info := range infos {
		if info.UpdateAt > maxUpdateAt {
			maxUpdateAt = info.UpdateAt
		}
	}

	return Etag(infos[0].PostId, maxUpdateAt)
}
