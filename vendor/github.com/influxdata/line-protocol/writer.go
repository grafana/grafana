package protocol

import (
	"fmt"
	"time"
)

// Write writes out data to a line protocol encoder.  Note: it does no sorting.  It assumes you have done your own sorting for tagValues
func (e *Encoder) Write(name []byte, ts time.Time, tagKeys, tagVals, fieldKeys [][]byte, fieldVals []interface{}) (int, error) {
	e.header = e.header[:0]
	if len(name) == 0 || name[len(name)-1] == byte('\\') {
		return 0, ErrInvalidName
	}
	nameEscapeBytes(&e.header, name)
	for i := range tagKeys {
		// Some keys and values are not encodeable as line protocol, such as
		// those with a trailing '\' or empty strings.
		if len(tagKeys[i]) == 0 || len(tagVals[i]) == 0 || tagKeys[i][len(tagKeys[i])-1] == byte('\\') {
			if e.failOnFieldError {
				return 0, fmt.Errorf("invalid field: key \"%s\", val \"%s\"", tagKeys[i], tagVals[i])
			}
			continue
		}
		e.header = append(e.header, byte(','))
		escapeBytes(&e.header, tagKeys[i])
		e.header = append(e.header, byte('='))
		escapeBytes(&e.header, tagVals[i])
	}
	e.header = append(e.header, byte(' '))
	e.buildFooter(ts)

	i := 0
	totalWritten := 0
	pairsLen := 0
	firstField := true
	for i := range fieldKeys {
		e.pair = e.pair[:0]
		key := fieldKeys[i]
		if len(key) == 0 || key[len(key)-1] == byte('\\') {
			if e.failOnFieldError {
				return 0, &FieldError{"invalid field key"}
			}
			continue
		}
		escapeBytes(&e.pair, key)
		// Some keys are not encodeable as line protocol, such as those with a
		// trailing '\' or empty strings.
		e.pair = append(e.pair, byte('='))
		err := e.buildFieldVal(fieldVals[i])
		if err != nil {
			if e.failOnFieldError {
				return 0, err
			}
			continue
		}

		bytesNeeded := len(e.header) + pairsLen + len(e.pair) + len(e.footer)

		// Additional length needed for field separator `,`
		if !firstField {
			bytesNeeded++
		}

		if e.maxLineBytes > 0 && bytesNeeded > e.maxLineBytes {
			// Need at least one field per line
			if firstField {
				return 0, ErrNeedMoreSpace
			}

			i, err = e.w.Write(e.footer)
			if err != nil {
				return 0, err
			}
			totalWritten += i

			bytesNeeded = len(e.header) + len(e.pair) + len(e.footer)

			if e.maxLineBytes > 0 && bytesNeeded > e.maxLineBytes {
				return 0, ErrNeedMoreSpace
			}

			i, err = e.w.Write(e.header)
			if err != nil {
				return 0, err
			}
			totalWritten += i

			i, err = e.w.Write(e.pair)
			if err != nil {
				return 0, err
			}
			totalWritten += i

			pairsLen += len(e.pair)
			firstField = false
			continue
		}

		if firstField {
			i, err = e.w.Write(e.header)
			if err != nil {
				return 0, err
			}
			totalWritten += i

		} else {
			i, err = e.w.Write(comma)
			if err != nil {
				return 0, err
			}
			totalWritten += i

		}

		e.w.Write(e.pair)

		pairsLen += len(e.pair)
		firstField = false
	}

	if firstField {
		return 0, ErrNoFields
	}
	i, err := e.w.Write(e.footer)
	if err != nil {
		return 0, err
	}
	totalWritten += i
	return totalWritten, nil
}
