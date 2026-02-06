// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package runtime

import (
	"bytes"
	"encoding"
	"errors"
	"fmt"
	"io"
	"reflect"

	"github.com/go-openapi/swag"
)

func defaultCloser() error { return nil }

type byteStreamOpt func(opts *byteStreamOpts)

// ClosesStream when the bytestream consumer or producer is finished
func ClosesStream(opts *byteStreamOpts) {
	opts.Close = true
}

type byteStreamOpts struct {
	Close bool
}

// ByteStreamConsumer creates a consumer for byte streams.
//
// The consumer consumes from a provided reader into the data passed by reference.
//
// Supported output underlying types and interfaces, prioritized in this order:
// - io.ReaderFrom (for maximum control)
// - io.Writer (performs io.Copy)
// - encoding.BinaryUnmarshaler
// - *string
// - *[]byte
func ByteStreamConsumer(opts ...byteStreamOpt) Consumer {
	var vals byteStreamOpts
	for _, opt := range opts {
		opt(&vals)
	}

	return ConsumerFunc(func(reader io.Reader, data interface{}) error {
		if reader == nil {
			return errors.New("ByteStreamConsumer requires a reader") // early exit
		}
		if data == nil {
			return errors.New("nil destination for ByteStreamConsumer")
		}

		closer := defaultCloser
		if vals.Close {
			if cl, isReaderCloser := reader.(io.Closer); isReaderCloser {
				closer = cl.Close
			}
		}
		defer func() {
			_ = closer()
		}()

		if readerFrom, isReaderFrom := data.(io.ReaderFrom); isReaderFrom {
			_, err := readerFrom.ReadFrom(reader)
			return err
		}

		if writer, isDataWriter := data.(io.Writer); isDataWriter {
			_, err := io.Copy(writer, reader)
			return err
		}

		// buffers input before writing to data
		var buf bytes.Buffer
		_, err := buf.ReadFrom(reader)
		if err != nil {
			return err
		}
		b := buf.Bytes()

		switch destinationPointer := data.(type) {
		case encoding.BinaryUnmarshaler:
			return destinationPointer.UnmarshalBinary(b)
		case *any:
			switch (*destinationPointer).(type) {
			case string:
				*destinationPointer = string(b)

				return nil

			case []byte:
				*destinationPointer = b

				return nil
			}
		default:
			// check for the underlying type to be pointer to []byte or string,
			if ptr := reflect.TypeOf(data); ptr.Kind() != reflect.Ptr {
				return errors.New("destination must be a pointer")
			}

			v := reflect.Indirect(reflect.ValueOf(data))
			t := v.Type()

			switch {
			case t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Uint8:
				v.SetBytes(b)
				return nil

			case t.Kind() == reflect.String:
				v.SetString(string(b))
				return nil
			}
		}

		return fmt.Errorf("%v (%T) is not supported by the ByteStreamConsumer, %s",
			data, data, "can be resolved by supporting Writer/BinaryUnmarshaler interface")
	})
}

// ByteStreamProducer creates a producer for byte streams.
//
// The producer takes input data then writes to an output writer (essentially as a pipe).
//
// Supported input underlying types and interfaces, prioritized in this order:
// - io.WriterTo (for maximum control)
// - io.Reader (performs io.Copy). A ReadCloser is closed before exiting.
// - encoding.BinaryMarshaler
// - error (writes as a string)
// - []byte
// - string
// - struct, other slices: writes as JSON
func ByteStreamProducer(opts ...byteStreamOpt) Producer {
	var vals byteStreamOpts
	for _, opt := range opts {
		opt(&vals)
	}

	return ProducerFunc(func(writer io.Writer, data interface{}) error {
		if writer == nil {
			return errors.New("ByteStreamProducer requires a writer") // early exit
		}
		if data == nil {
			return errors.New("nil data for ByteStreamProducer")
		}

		closer := defaultCloser
		if vals.Close {
			if cl, isWriterCloser := writer.(io.Closer); isWriterCloser {
				closer = cl.Close
			}
		}
		defer func() {
			_ = closer()
		}()

		if rc, isDataCloser := data.(io.ReadCloser); isDataCloser {
			defer rc.Close()
		}

		switch origin := data.(type) {
		case io.WriterTo:
			_, err := origin.WriteTo(writer)
			return err

		case io.Reader:
			_, err := io.Copy(writer, origin)
			return err

		case encoding.BinaryMarshaler:
			bytes, err := origin.MarshalBinary()
			if err != nil {
				return err
			}

			_, err = writer.Write(bytes)
			return err

		case error:
			_, err := writer.Write([]byte(origin.Error()))
			return err

		default:
			v := reflect.Indirect(reflect.ValueOf(data))
			t := v.Type()

			switch {
			case t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Uint8:
				_, err := writer.Write(v.Bytes())
				return err

			case t.Kind() == reflect.String:
				_, err := writer.Write([]byte(v.String()))
				return err

			case t.Kind() == reflect.Struct || t.Kind() == reflect.Slice:
				b, err := swag.WriteJSON(data)
				if err != nil {
					return err
				}

				_, err = writer.Write(b)
				return err
			}
		}

		return fmt.Errorf("%v (%T) is not supported by the ByteStreamProducer, %s",
			data, data, "can be resolved by supporting Reader/BinaryMarshaler interface")
	})
}
