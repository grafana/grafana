// Copyright 2014 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"sync"
	"unicode/utf8"

	"google.golang.org/api/googleapi"
	raw "google.golang.org/api/storage/v1"
)

// A Writer writes a Cloud Storage object.
type Writer struct {
	// ObjectAttrs are optional attributes to set on the object. Any attributes
	// must be initialized before the first Write call. Nil or zero-valued
	// attributes are ignored.
	ObjectAttrs

	// SendCRC specifies whether to transmit a CRC32C field. It should be set
	// to true in addition to setting the Writer's CRC32C field, because zero
	// is a valid CRC and normally a zero would not be transmitted.
	// If a CRC32C is sent, and the data written does not match the checksum,
	// the write will be rejected.
	SendCRC32C bool

	// ChunkSize controls the maximum number of bytes of the object that the
	// Writer will attempt to send to the server in a single request. Objects
	// smaller than the size will be sent in a single request, while larger
	// objects will be split over multiple requests. The size will be rounded up
	// to the nearest multiple of 256K.
	//
	// ChunkSize will default to a reasonable value. If you perform many
	// concurrent writes of small objects (under ~8MB), you may wish set ChunkSize
	// to a value that matches your objects' sizes to avoid consuming large
	// amounts of memory. See
	// https://cloud.google.com/storage/docs/json_api/v1/how-tos/upload#size
	// for more information about performance trade-offs related to ChunkSize.
	//
	// If ChunkSize is set to zero, chunking will be disabled and the object will
	// be uploaded in a single request without the use of a buffer. This will
	// further reduce memory used during uploads, but will also prevent the writer
	// from retrying in case of a transient error from the server, since a buffer
	// is required in order to retry the failed request.
	//
	// ChunkSize must be set before the first Write call.
	ChunkSize int

	// ProgressFunc can be used to monitor the progress of a large write.
	// operation. If ProgressFunc is not nil and writing requires multiple
	// calls to the underlying service (see
	// https://cloud.google.com/storage/docs/json_api/v1/how-tos/resumable-upload),
	// then ProgressFunc will be invoked after each call with the number of bytes of
	// content copied so far.
	//
	// ProgressFunc should return quickly without blocking.
	ProgressFunc func(int64)

	ctx context.Context
	o   *ObjectHandle

	opened bool
	pw     *io.PipeWriter

	donec chan struct{} // closed after err and obj are set.
	obj   *ObjectAttrs

	mu  sync.Mutex
	err error
}

func (w *Writer) open() error {
	attrs := w.ObjectAttrs
	// Check the developer didn't change the object Name (this is unfortunate, but
	// we don't want to store an object under the wrong name).
	if attrs.Name != w.o.object {
		return fmt.Errorf("storage: Writer.Name %q does not match object name %q", attrs.Name, w.o.object)
	}
	if !utf8.ValidString(attrs.Name) {
		return fmt.Errorf("storage: object name %q is not valid UTF-8", attrs.Name)
	}
	if attrs.KMSKeyName != "" && w.o.encryptionKey != nil {
		return errors.New("storage: cannot use KMSKeyName with a customer-supplied encryption key")
	}
	pr, pw := io.Pipe()
	w.pw = pw
	w.opened = true

	go w.monitorCancel()

	if w.ChunkSize < 0 {
		return errors.New("storage: Writer.ChunkSize must be non-negative")
	}
	mediaOpts := []googleapi.MediaOption{
		googleapi.ChunkSize(w.ChunkSize),
	}
	if c := attrs.ContentType; c != "" {
		mediaOpts = append(mediaOpts, googleapi.ContentType(c))
	}

	go func() {
		defer close(w.donec)

		rawObj := attrs.toRawObject(w.o.bucket)
		if w.SendCRC32C {
			rawObj.Crc32c = encodeUint32(attrs.CRC32C)
		}
		if w.MD5 != nil {
			rawObj.Md5Hash = base64.StdEncoding.EncodeToString(w.MD5)
		}
		if w.o.c.envHost != "" {
			w.o.c.raw.BasePath = fmt.Sprintf("%s://%s", w.o.c.scheme, w.o.c.envHost)
		}
		call := w.o.c.raw.Objects.Insert(w.o.bucket, rawObj).
			Media(pr, mediaOpts...).
			Projection("full").
			Context(w.ctx).
			Name(w.o.object)

		if w.ProgressFunc != nil {
			call.ProgressUpdater(func(n, _ int64) { w.ProgressFunc(n) })
		}
		if attrs.KMSKeyName != "" {
			call.KmsKeyName(attrs.KMSKeyName)
		}
		if attrs.PredefinedACL != "" {
			call.PredefinedAcl(attrs.PredefinedACL)
		}
		if err := setEncryptionHeaders(call.Header(), w.o.encryptionKey, false); err != nil {
			w.mu.Lock()
			w.err = err
			w.mu.Unlock()
			pr.CloseWithError(err)
			return
		}
		var resp *raw.Object
		err := applyConds("NewWriter", w.o.gen, w.o.conds, call)
		if err == nil {
			if w.o.userProject != "" {
				call.UserProject(w.o.userProject)
			}
			setClientHeader(call.Header())

			// The internals that perform call.Do automatically retry both the initial
			// call to set up the upload as well as calls to upload individual chunks
			// for a resumable upload (as long as the chunk size is non-zero). Hence
			// there is no need to add retries here.
			resp, err = call.Do()
		}
		if err != nil {
			w.mu.Lock()
			w.err = err
			w.mu.Unlock()
			pr.CloseWithError(err)
			return
		}
		w.obj = newObject(resp)
	}()
	return nil
}

// Write appends to w. It implements the io.Writer interface.
//
// Since writes happen asynchronously, Write may return a nil
// error even though the write failed (or will fail). Always
// use the error returned from Writer.Close to determine if
// the upload was successful.
//
// Writes will be retried on transient errors from the server, unless
// Writer.ChunkSize has been set to zero.
func (w *Writer) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	werr := w.err
	w.mu.Unlock()
	if werr != nil {
		return 0, werr
	}
	if !w.opened {
		if err := w.open(); err != nil {
			return 0, err
		}
	}
	n, err = w.pw.Write(p)
	if err != nil {
		w.mu.Lock()
		werr := w.err
		w.mu.Unlock()
		// Preserve existing functionality that when context is canceled, Write will return
		// context.Canceled instead of "io: read/write on closed pipe". This hides the
		// pipe implementation detail from users and makes Write seem as though it's an RPC.
		if werr == context.Canceled || werr == context.DeadlineExceeded {
			return n, werr
		}
	}
	return n, err
}

// Close completes the write operation and flushes any buffered data.
// If Close doesn't return an error, metadata about the written object
// can be retrieved by calling Attrs.
func (w *Writer) Close() error {
	if !w.opened {
		if err := w.open(); err != nil {
			return err
		}
	}

	// Closing either the read or write causes the entire pipe to close.
	if err := w.pw.Close(); err != nil {
		return err
	}

	<-w.donec
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.err
}

// monitorCancel is intended to be used as a background goroutine. It monitors the
// context, and when it observes that the context has been canceled, it manually
// closes things that do not take a context.
func (w *Writer) monitorCancel() {
	select {
	case <-w.ctx.Done():
		w.mu.Lock()
		werr := w.ctx.Err()
		w.err = werr
		w.mu.Unlock()

		// Closing either the read or write causes the entire pipe to close.
		w.CloseWithError(werr)
	case <-w.donec:
	}
}

// CloseWithError aborts the write operation with the provided error.
// CloseWithError always returns nil.
//
// Deprecated: cancel the context passed to NewWriter instead.
func (w *Writer) CloseWithError(err error) error {
	if !w.opened {
		return nil
	}
	return w.pw.CloseWithError(err)
}

// Attrs returns metadata about a successfully-written object.
// It's only valid to call it after Close returns nil.
func (w *Writer) Attrs() *ObjectAttrs {
	return w.obj
}
