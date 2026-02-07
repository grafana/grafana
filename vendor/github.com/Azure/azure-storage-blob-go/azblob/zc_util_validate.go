package azblob

import (
	"errors"
	"fmt"
	"io"
	"strconv"
)

// httpRange defines a range of bytes within an HTTP resource, starting at offset and
// ending at offset+count. A zero-value httpRange indicates the entire resource. An httpRange
// which has an offset but na zero value count indicates from the offset to the resource's end.
type httpRange struct {
	offset int64
	count  int64
}

func (r httpRange) pointers() *string {
	if r.offset == 0 && r.count == CountToEnd { // Do common case first for performance
		return nil // No specified range
	}
	endOffset := "" // if count == CountToEnd (0)
	if r.count > 0 {
		endOffset = strconv.FormatInt((r.offset+r.count)-1, 10)
	}
	dataRange := fmt.Sprintf("bytes=%v-%s", r.offset, endOffset)
	return &dataRange
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func validateSeekableStreamAt0AndGetCount(body io.ReadSeeker) (int64, error) {
	if body == nil { // nil body's are "logically" seekable to 0 and are 0 bytes long
		return 0, nil
	}

	err := validateSeekableStreamAt0(body)
	if err != nil {
		return 0, err
	}

	count, err := body.Seek(0, io.SeekEnd)
	if err != nil {
		return 0, errors.New("body stream must be seekable")
	}

	body.Seek(0, io.SeekStart)
	return count, nil
}

// return an error if body is not a valid seekable stream at 0
func validateSeekableStreamAt0(body io.ReadSeeker) error {
	if body == nil { // nil body's are "logically" seekable to 0
		return nil
	}
	if pos, err := body.Seek(0, io.SeekCurrent); pos != 0 || err != nil {
		// Help detect programmer error
		if err != nil {
			return errors.New("body stream must be seekable")
		}
		return errors.New("body stream must be set to position 0")
	}
	return nil
}
