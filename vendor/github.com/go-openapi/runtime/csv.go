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
	"context"
	"encoding"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"reflect"

	"golang.org/x/sync/errgroup"
)

// CSVConsumer creates a new CSV consumer.
//
// The consumer consumes CSV records from a provided reader into the data passed by reference.
//
// CSVOpts options may be specified to alter the default CSV behavior on the reader and the writer side (e.g. separator, skip header, ...).
// The defaults are those of the standard library's csv.Reader and csv.Writer.
//
// Supported output underlying types and interfaces, prioritized in this order:
// - *csv.Writer
// - CSVWriter (writer options are ignored)
// - io.Writer (as raw bytes)
// - io.ReaderFrom (as raw bytes)
// - encoding.BinaryUnmarshaler (as raw bytes)
// - *[][]string (as a collection of records)
// - *[]byte (as raw bytes)
// - *string (a raw bytes)
//
// The consumer prioritizes situations where buffering the input is not required.
func CSVConsumer(opts ...CSVOpt) Consumer {
	o := csvOptsWithDefaults(opts)

	return ConsumerFunc(func(reader io.Reader, data interface{}) error {
		if reader == nil {
			return errors.New("CSVConsumer requires a reader")
		}
		if data == nil {
			return errors.New("nil destination for CSVConsumer")
		}

		csvReader := csv.NewReader(reader)
		o.applyToReader(csvReader)
		closer := defaultCloser
		if o.closeStream {
			if cl, isReaderCloser := reader.(io.Closer); isReaderCloser {
				closer = cl.Close
			}
		}
		defer func() {
			_ = closer()
		}()

		switch destination := data.(type) {
		case *csv.Writer:
			csvWriter := destination
			o.applyToWriter(csvWriter)

			return pipeCSV(csvWriter, csvReader, o)

		case CSVWriter:
			csvWriter := destination
			// no writer options available

			return pipeCSV(csvWriter, csvReader, o)

		case io.Writer:
			csvWriter := csv.NewWriter(destination)
			o.applyToWriter(csvWriter)

			return pipeCSV(csvWriter, csvReader, o)

		case io.ReaderFrom:
			var buf bytes.Buffer
			csvWriter := csv.NewWriter(&buf)
			o.applyToWriter(csvWriter)
			if err := bufferedCSV(csvWriter, csvReader, o); err != nil {
				return err
			}
			_, err := destination.ReadFrom(&buf)

			return err

		case encoding.BinaryUnmarshaler:
			var buf bytes.Buffer
			csvWriter := csv.NewWriter(&buf)
			o.applyToWriter(csvWriter)
			if err := bufferedCSV(csvWriter, csvReader, o); err != nil {
				return err
			}

			return destination.UnmarshalBinary(buf.Bytes())

		default:
			// support *[][]string, *[]byte, *string
			if ptr := reflect.TypeOf(data); ptr.Kind() != reflect.Ptr {
				return errors.New("destination must be a pointer")
			}

			v := reflect.Indirect(reflect.ValueOf(data))
			t := v.Type()

			switch {
			case t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Slice && t.Elem().Elem().Kind() == reflect.String:
				csvWriter := &csvRecordsWriter{}
				// writer options are ignored
				if err := pipeCSV(csvWriter, csvReader, o); err != nil {
					return err
				}

				v.Grow(len(csvWriter.records))
				v.SetCap(len(csvWriter.records)) // in case Grow was unnessary, trim down the capacity
				v.SetLen(len(csvWriter.records))
				reflect.Copy(v, reflect.ValueOf(csvWriter.records))

				return nil

			case t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Uint8:
				var buf bytes.Buffer
				csvWriter := csv.NewWriter(&buf)
				o.applyToWriter(csvWriter)
				if err := bufferedCSV(csvWriter, csvReader, o); err != nil {
					return err
				}
				v.SetBytes(buf.Bytes())

				return nil

			case t.Kind() == reflect.String:
				var buf bytes.Buffer
				csvWriter := csv.NewWriter(&buf)
				o.applyToWriter(csvWriter)
				if err := bufferedCSV(csvWriter, csvReader, o); err != nil {
					return err
				}
				v.SetString(buf.String())

				return nil

			default:
				return fmt.Errorf("%v (%T) is not supported by the CSVConsumer, %s",
					data, data, "can be resolved by supporting CSVWriter/Writer/BinaryUnmarshaler interface",
				)
			}
		}
	})
}

// CSVProducer creates a new CSV producer.
//
// The producer takes input data then writes as CSV to an output writer (essentially as a pipe).
//
// Supported input underlying types and interfaces, prioritized in this order:
// - *csv.Reader
// - CSVReader (reader options are ignored)
// - io.Reader
// - io.WriterTo
// - encoding.BinaryMarshaler
// - [][]string
// - []byte
// - string
//
// The producer prioritizes situations where buffering the input is not required.
func CSVProducer(opts ...CSVOpt) Producer {
	o := csvOptsWithDefaults(opts)

	return ProducerFunc(func(writer io.Writer, data interface{}) error {
		if writer == nil {
			return errors.New("CSVProducer requires a writer")
		}
		if data == nil {
			return errors.New("nil data for CSVProducer")
		}

		csvWriter := csv.NewWriter(writer)
		o.applyToWriter(csvWriter)
		closer := defaultCloser
		if o.closeStream {
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
		case *csv.Reader:
			csvReader := origin
			o.applyToReader(csvReader)

			return pipeCSV(csvWriter, csvReader, o)

		case CSVReader:
			csvReader := origin
			// no reader options available

			return pipeCSV(csvWriter, csvReader, o)

		case io.Reader:
			csvReader := csv.NewReader(origin)
			o.applyToReader(csvReader)

			return pipeCSV(csvWriter, csvReader, o)

		case io.WriterTo:
			// async piping of the writes performed by WriteTo
			r, w := io.Pipe()
			csvReader := csv.NewReader(r)
			o.applyToReader(csvReader)

			pipe, _ := errgroup.WithContext(context.Background())
			pipe.Go(func() error {
				_, err := origin.WriteTo(w)
				_ = w.Close()
				return err
			})

			pipe.Go(func() error {
				defer func() {
					_ = r.Close()
				}()

				return pipeCSV(csvWriter, csvReader, o)
			})

			return pipe.Wait()

		case encoding.BinaryMarshaler:
			buf, err := origin.MarshalBinary()
			if err != nil {
				return err
			}
			rdr := bytes.NewBuffer(buf)
			csvReader := csv.NewReader(rdr)

			return bufferedCSV(csvWriter, csvReader, o)

		default:
			// support [][]string, []byte, string (or pointers to those)
			v := reflect.Indirect(reflect.ValueOf(data))
			t := v.Type()

			switch {
			case t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Slice && t.Elem().Elem().Kind() == reflect.String:
				csvReader := &csvRecordsWriter{
					records: make([][]string, v.Len()),
				}
				reflect.Copy(reflect.ValueOf(csvReader.records), v)

				return pipeCSV(csvWriter, csvReader, o)

			case t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Uint8:
				buf := bytes.NewBuffer(v.Bytes())
				csvReader := csv.NewReader(buf)
				o.applyToReader(csvReader)

				return bufferedCSV(csvWriter, csvReader, o)

			case t.Kind() == reflect.String:
				buf := bytes.NewBufferString(v.String())
				csvReader := csv.NewReader(buf)
				o.applyToReader(csvReader)

				return bufferedCSV(csvWriter, csvReader, o)

			default:
				return fmt.Errorf("%v (%T) is not supported by the CSVProducer, %s",
					data, data, "can be resolved by supporting CSVReader/Reader/BinaryMarshaler interface",
				)
			}
		}
	})
}

// pipeCSV copies CSV records from a CSV reader to a CSV writer
func pipeCSV(csvWriter CSVWriter, csvReader CSVReader, opts csvOpts) error {
	for ; opts.skippedLines > 0; opts.skippedLines-- {
		_, err := csvReader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}

			return err
		}
	}

	for {
		record, err := csvReader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}

			return err
		}

		if err := csvWriter.Write(record); err != nil {
			return err
		}
	}

	csvWriter.Flush()

	return csvWriter.Error()
}

// bufferedCSV copies CSV records from a CSV reader to a CSV writer,
// by first reading all records then writing them at once.
func bufferedCSV(csvWriter *csv.Writer, csvReader *csv.Reader, opts csvOpts) error {
	for ; opts.skippedLines > 0; opts.skippedLines-- {
		_, err := csvReader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}

			return err
		}
	}

	records, err := csvReader.ReadAll()
	if err != nil {
		return err
	}

	return csvWriter.WriteAll(records)
}
