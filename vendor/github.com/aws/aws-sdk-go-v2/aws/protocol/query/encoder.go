package query

import (
	"io"
	"net/url"
	"sort"
)

// Encoder is a Query encoder that supports construction of Query body
// values using methods.
type Encoder struct {
	// The query values that will be built up to manage encoding.
	values url.Values
	// The writer that the encoded body will be written to.
	writer io.Writer
	Value
}

// NewEncoder returns a new Query body encoder
func NewEncoder(writer io.Writer) *Encoder {
	values := url.Values{}
	return &Encoder{
		values: values,
		writer: writer,
		Value:  newBaseValue(values),
	}
}

// Encode returns the []byte slice representing the current
// state of the Query encoder.
func (e Encoder) Encode() error {
	ws, ok := e.writer.(interface{ WriteString(string) (int, error) })
	if !ok {
		// Fall back to less optimal byte slice casting if WriteString isn't available.
		ws = &wrapWriteString{writer: e.writer}
	}

	// Get the keys and sort them to have a stable output
	keys := make([]string, 0, len(e.values))
	for k := range e.values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	isFirstEntry := true
	for _, key := range keys {
		queryValues := e.values[key]
		escapedKey := url.QueryEscape(key)
		for _, value := range queryValues {
			if !isFirstEntry {
				if _, err := ws.WriteString(`&`); err != nil {
					return err
				}
			} else {
				isFirstEntry = false
			}
			if _, err := ws.WriteString(escapedKey); err != nil {
				return err
			}
			if _, err := ws.WriteString(`=`); err != nil {
				return err
			}
			if _, err := ws.WriteString(url.QueryEscape(value)); err != nil {
				return err
			}
		}
	}
	return nil
}

// wrapWriteString wraps an io.Writer to provide a WriteString method
// where one is not available.
type wrapWriteString struct {
	writer io.Writer
}

// WriteString writes a string to the wrapped writer by casting it to
// a byte array first.
func (w wrapWriteString) WriteString(v string) (int, error) {
	return w.writer.Write([]byte(v))
}
