package requestcompression

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
)

func gzipCompress(input io.Reader) ([]byte, error) {
	var b bytes.Buffer
	w, err := gzip.NewWriterLevel(&b, gzip.DefaultCompression)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip writer, %v", err)
	}

	inBytes, err := io.ReadAll(input)
	if err != nil {
		return nil, fmt.Errorf("failed read payload to compress, %v", err)
	}

	if _, err = w.Write(inBytes); err != nil {
		return nil, fmt.Errorf("failed to write payload to be compressed, %v", err)
	}
	if err = w.Close(); err != nil {
		return nil, fmt.Errorf("failed to flush payload being compressed, %v", err)
	}

	return b.Bytes(), nil
}
