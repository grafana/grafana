package types

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
)

type File struct {
	multipart *multipart.FileHeader
	data      []byte
	filename  string
}

func (file *File) InitFromMultipart(header *multipart.FileHeader) {
	file.multipart = header
	file.data = nil
	file.filename = ""
}

func (file *File) InitFromBytes(data []byte, filename string) {
	file.data = data
	file.filename = filename
	file.multipart = nil
}

func (file File) MarshalJSON() ([]byte, error) {
	b, err := file.Bytes()
	if err != nil {
		return nil, err
	}
	return json.Marshal(b)
}

func (file *File) UnmarshalJSON(data []byte) error {
	return json.Unmarshal(data, &file.data)
}

func (file File) Bytes() ([]byte, error) {
	if file.multipart != nil {
		f, err := file.multipart.Open()
		if err != nil {
			return nil, err
		}
		defer func() { _ = f.Close() }()
		return io.ReadAll(f)
	}
	return file.data, nil
}

func (file File) Reader() (io.ReadCloser, error) {
	if file.multipart != nil {
		return file.multipart.Open()
	}
	return io.NopCloser(bytes.NewReader(file.data)), nil
}

func (file File) Filename() string {
	if file.multipart != nil {
		return file.multipart.Filename
	}
	return file.filename
}

func (file File) FileSize() int64 {
	if file.multipart != nil {
		return file.multipart.Size
	}
	return int64(len(file.data))
}
