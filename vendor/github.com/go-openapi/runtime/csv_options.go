package runtime

import (
	"encoding/csv"
	"io"
)

// CSVOpts alter the behavior of the CSV consumer or producer.
type CSVOpt func(*csvOpts)

type csvOpts struct {
	csvReader    csv.Reader
	csvWriter    csv.Writer
	skippedLines int
	closeStream  bool
}

// WithCSVReaderOpts specifies the options to csv.Reader
// when reading CSV.
func WithCSVReaderOpts(reader csv.Reader) CSVOpt {
	return func(o *csvOpts) {
		o.csvReader = reader
	}
}

// WithCSVWriterOpts specifies the options to csv.Writer
// when writing CSV.
func WithCSVWriterOpts(writer csv.Writer) CSVOpt {
	return func(o *csvOpts) {
		o.csvWriter = writer
	}
}

// WithCSVSkipLines will skip header lines.
func WithCSVSkipLines(skipped int) CSVOpt {
	return func(o *csvOpts) {
		o.skippedLines = skipped
	}
}

func WithCSVClosesStream() CSVOpt {
	return func(o *csvOpts) {
		o.closeStream = true
	}
}

func (o csvOpts) applyToReader(in *csv.Reader) {
	if o.csvReader.Comma != 0 {
		in.Comma = o.csvReader.Comma
	}
	if o.csvReader.Comment != 0 {
		in.Comment = o.csvReader.Comment
	}
	if o.csvReader.FieldsPerRecord != 0 {
		in.FieldsPerRecord = o.csvReader.FieldsPerRecord
	}

	in.LazyQuotes = o.csvReader.LazyQuotes
	in.TrimLeadingSpace = o.csvReader.TrimLeadingSpace
	in.ReuseRecord = o.csvReader.ReuseRecord
}

func (o csvOpts) applyToWriter(in *csv.Writer) {
	if o.csvWriter.Comma != 0 {
		in.Comma = o.csvWriter.Comma
	}
	in.UseCRLF = o.csvWriter.UseCRLF
}

func csvOptsWithDefaults(opts []CSVOpt) csvOpts {
	var o csvOpts
	for _, apply := range opts {
		apply(&o)
	}

	return o
}

type CSVWriter interface {
	Write([]string) error
	Flush()
	Error() error
}

type CSVReader interface {
	Read() ([]string, error)
}

var (
	_ CSVWriter = &csvRecordsWriter{}
	_ CSVReader = &csvRecordsWriter{}
)

// csvRecordsWriter is an internal container to move CSV records back and forth
type csvRecordsWriter struct {
	i       int
	records [][]string
}

func (w *csvRecordsWriter) Write(record []string) error {
	w.records = append(w.records, record)

	return nil
}

func (w *csvRecordsWriter) Read() ([]string, error) {
	if w.i >= len(w.records) {
		return nil, io.EOF
	}
	defer func() {
		w.i++
	}()

	return w.records[w.i], nil
}

func (w *csvRecordsWriter) Flush() {}

func (w *csvRecordsWriter) Error() error {
	return nil
}
