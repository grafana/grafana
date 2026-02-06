// Copyright 2020-2021 InfluxData, Inc.. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package gzip provides GZip related functionality
package gzip

import (
	"compress/gzip"
	"io"
	"sync"
)

// ReadWaitCloser is ReadCloser that waits for finishing underlying reader
type ReadWaitCloser struct {
	pipeReader *io.PipeReader
	wg         sync.WaitGroup
}

// Close closes underlying reader and waits for finishing operations
func (r *ReadWaitCloser) Close() error {
	err := r.pipeReader.Close()
	r.wg.Wait() // wait for the gzip goroutine finish
	return err
}

// CompressWithGzip takes an io.Reader as input and pipes
// it through a gzip.Writer returning an io.Reader containing
// the gzipped data.
// An error is returned if passing data to the gzip.Writer fails
// this is shamelessly stolen from https://github.com/influxdata/telegraf
func CompressWithGzip(data io.Reader) (io.ReadCloser, error) {
	pipeReader, pipeWriter := io.Pipe()
	gzipWriter := gzip.NewWriter(pipeWriter)

	rc := &ReadWaitCloser{
		pipeReader: pipeReader,
	}

	rc.wg.Add(1)
	var err error
	go func() {
		_, err = io.Copy(gzipWriter, data)
		gzipWriter.Close()
		// subsequent reads from the read half of the pipe will
		// return no bytes and the error err, or EOF if err is nil.
		pipeWriter.CloseWithError(err)
		rc.wg.Done()
	}()

	return pipeReader, err
}
