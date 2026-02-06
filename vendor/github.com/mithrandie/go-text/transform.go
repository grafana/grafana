package text

import (
	"bytes"
	"errors"
	"io"
	"io/ioutil"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

const (
	UTF8BOM    = "\xef\xbb\xbf"
	UTF16BEBOM = "\xfe\xff"
	UTF16LEBOM = "\xff\xfe"
)

const (
	SurrogatePairHighBegin = "\xd8\x00"
	SurrogatePairHighEnd   = "\xdb\xff"
	SurrogatePairLowBegin  = "\xdc\x00"
	SurrogatePairLowEnd    = "\xdf\xff"
)

func IsHighSurrogate(r rune) bool {
	return rune(SurrogatePairHighBegin[0])<<8|rune(SurrogatePairHighBegin[1]) <= r && r <= rune(SurrogatePairHighEnd[0])<<8|rune(SurrogatePairHighEnd[1])
}

func IsLowSurrogate(r rune) bool {
	return rune(SurrogatePairLowBegin[0])<<8|rune(SurrogatePairLowBegin[1]) <= r && r <= rune(SurrogatePairLowEnd[0])<<8|rune(SurrogatePairLowEnd[1])
}

var ErrUnknownEncoding = errors.New("cannot detect character encoding")
var ErrInvalidEncoding = errors.New("invalid character encoding")

// DetectEncoding Detects character encoding
func DetectEncoding(r io.ReadSeeker) (detected Encoding, err error) {
	return DetectInSpecifiedEncoding(r, AUTO)
}

func DetectInSpecifiedEncoding(r io.ReadSeeker, enc Encoding) (detected Encoding, err error) {
	switch enc {
	case UTF8M, UTF16BEM, UTF16LEM, UTF16BE, UTF16LE, SJIS:
		return enc, nil
	}

	defer func() {
		if _, e := r.Seek(0, io.SeekStart); e != nil {
			err = e
		}
	}()

	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return detected, err
	}

	lead := make([]byte, 3)
	n, err := r.Read(lead)
	if n < 1 && err == io.EOF {
		return UTF8, nil
	}
	if enc == AUTO || enc == UTF8 {
		if n == 3 && lead[0] == UTF8BOM[0] && lead[1] == UTF8BOM[1] && lead[2] == UTF8BOM[2] {
			return UTF8M, nil
		}
	}
	if (enc == AUTO || enc == UTF16) && 1 < n {
		if lead[0] == UTF16BEBOM[0] && lead[1] == UTF16BEBOM[1] {
			return UTF16BEM, nil
		} else if lead[0] == UTF16LEBOM[0] && lead[1] == UTF16LEBOM[1] {
			return UTF16LEM, nil
		}
	}

	if enc == UTF8 {
		return UTF8, nil
	} else if enc == UTF16 {
		return UTF16BE, nil
	}

	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return detected, err
	}

	lead = make([]byte, 1024)
	n, err = r.Read(lead)
	return InferEncoding(lead[:n], err == io.EOF)
}

func InferEncoding(b []byte, eof bool) (Encoding, error) {
	if len(b) < 1 {
		return UTF8, nil
	}

	var isInRange = func(pos int) bool {
		return pos < len(b)
	}

	var between = func(b byte, low byte, high byte) bool {
		return low <= b && b <= high
	}

	utf8Idx := 0
	utf16Idx := 1
	sjisIdx := 2
	nextPos := []int{0, 0, 0}
	validEnc := make([]int, 0, 3)

	latinBeCnt := 0
	latinLeCnt := 0

	pos := 0
	for {
		validEnc = validEnc[:0]
		for i := range nextPos {
			if -1 < nextPos[i] {
				validEnc = append(validEnc, i)
			}
		}

		if !isInRange(pos) {
			break
		}

		if (len(validEnc)) < 2 && !(len(validEnc) == 1 && -1 < nextPos[utf16Idx]) {
			break
		}

		if nextPos[sjisIdx] == pos {
			switch {
			case between(b[pos], 0x00, 0x7f) || between(b[pos], 0xa0, 0xdf):
				nextPos[sjisIdx] = nextPos[sjisIdx] + 1
			case between(b[pos], 0x81, 0x9f) || between(b[pos], 0xe0, 0xef):
				if (eof && !isInRange(pos+1)) ||
					(isInRange(pos+1) && !between(b[pos+1], 0x40, 0x7e) && !between(b[pos+1], 0x80, 0xfc)) {
					nextPos[sjisIdx] = -1
				} else {
					nextPos[sjisIdx] = nextPos[sjisIdx] + 2
				}
			default:
				nextPos[sjisIdx] = -1
			}
		}

		if nextPos[utf8Idx] == pos {
			switch {
			case between(b[pos], 0x00, 0x7f):
				nextPos[utf8Idx] = nextPos[utf8Idx] + 1
			case between(b[pos], 0xc2, 0xdf):
				if (eof && !isInRange(pos+1)) ||
					(isInRange(pos+1) && !between(b[pos+1], 0x80, 0xbf)) {
					nextPos[utf8Idx] = -1
				} else {
					nextPos[utf8Idx] = nextPos[utf8Idx] + 2
				}
			case between(b[pos], 0xe0, 0xef):
				if (eof && !isInRange(pos+2)) ||
					(isInRange(pos+2) && !(between(b[pos+1], 0x80, 0xbf) && between(b[pos+2], 0x80, 0xbf))) {
					nextPos[utf8Idx] = -1
				} else {
					nextPos[utf8Idx] = nextPos[utf8Idx] + 3
				}
			case between(b[pos], 0xf0, 0xf7):
				if (eof && !isInRange(pos+3)) ||
					(isInRange(pos+3) && !(between(b[pos+1], 0x80, 0xbf) && between(b[pos+2], 0x80, 0xbf) && between(b[pos+3], 0x80, 0xbf))) {
					nextPos[utf8Idx] = -1
				} else {
					nextPos[utf8Idx] = nextPos[utf8Idx] + 4
				}
			default:
				nextPos[utf8Idx] = -1
			}
		}

		if nextPos[utf16Idx] == pos {
			if eof && !isInRange(pos+1) {
				nextPos[utf16Idx] = -1
			} else if isInRange(pos + 1) {
				if b[pos] == 0x00 && between(b[pos+1], 0x01, 0xff) {
					latinBeCnt++
				} else if b[pos+1] == 0x00 && between(b[pos], 0x00, 0xff) {
					latinLeCnt++
				}
				if 5 < latinBeCnt || 5 < latinLeCnt {
					goto InferredAsUTF16
				}

				if between(b[pos], 0xdc, 0xdf) {
					if IsLowSurrogate(rune(b[pos])<<8 | rune(b[pos+1])) {
						nextPos[utf16Idx] = -1
					}
				}
				if -1 < nextPos[utf16Idx] && between(b[pos+1], 0xdc, 0xdf) {
					if IsLowSurrogate(rune(b[pos+1])<<8 | rune(b[pos])) {
						nextPos[utf16Idx] = -1
					}
				}
			}

			if isInRange(pos + 3) {
				if -1 < nextPos[utf16Idx] && between(b[pos], 0xd8, 0xdb) {
					if IsHighSurrogate(rune(b[pos])<<8 | rune(b[pos+1])) {
						if IsLowSurrogate(rune(b[pos+2])<<8 | rune(b[pos+3])) {
							return UTF16BE, nil
						}
						nextPos[utf16Idx] = -1
					}
				}
				if -1 < nextPos[utf16Idx] && between(b[pos+1], 0xd8, 0xdb) {
					if IsHighSurrogate(rune(b[pos+1])<<8 | rune(b[pos])) {
						if IsLowSurrogate(rune(b[pos+3])<<8 | rune(b[pos+2])) {
							return UTF16LE, nil
						}
						nextPos[utf16Idx] = -1
					}
				}
			}

			if -1 < nextPos[utf16Idx] {
				nextPos[utf16Idx] = nextPos[utf16Idx] + 2
			}
		}

		pos++
	}

	if 0 < latinBeCnt || 0 < latinLeCnt {
		if -1 < nextPos[utf16Idx] {
			goto InferredAsUTF16
		} else {
			return UTF8, ErrUnknownEncoding
		}
	}

	switch len(validEnc) {
	case 0:
		return UTF8, ErrUnknownEncoding
	case 1:
		switch validEnc[0] {
		case utf8Idx:
			return UTF8, nil
		case sjisIdx:
			return SJIS, nil
		default:
			goto InferredAsUTF16
		}
	default:
		if -1 < nextPos[utf8Idx] {
			return UTF8, nil
		} else if -1 < nextPos[sjisIdx] {
			return SJIS, nil
		} else {
			goto InferredAsUTF16
		}
	}

InferredAsUTF16:
	if latinBeCnt < latinLeCnt {
		return UTF16LE, nil
	}
	return UTF16BE, nil
}

// GetTransformEncoder gets a reader to transform character encoding from UTF-8 to another encoding.
func GetTransformEncoder(r io.Reader, enc Encoding) (io.Reader, error) {
	switch enc {
	case UTF8:
		return transform.NewReader(r, unicode.UTF8.NewEncoder()), nil
	case UTF8M:
		return transform.NewReader(r, NewUTF8MEncoder()), nil
	case UTF16:
		return transform.NewReader(r, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewEncoder()), nil
	case UTF16BE:
		return transform.NewReader(r, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewEncoder()), nil
	case UTF16LE:
		return transform.NewReader(r, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewEncoder()), nil
	case UTF16BEM:
		return transform.NewReader(r, unicode.UTF16(unicode.BigEndian, unicode.ExpectBOM).NewEncoder()), nil
	case UTF16LEM:
		return transform.NewReader(r, unicode.UTF16(unicode.LittleEndian, unicode.ExpectBOM).NewEncoder()), nil
	case SJIS:
		return transform.NewReader(r, japanese.ShiftJIS.NewEncoder()), nil
	default:
		return nil, ErrInvalidEncoding
	}
}

// GetTransformDecoder gets a reader to transform character encoding from any encoding to UTF-8.
func GetTransformDecoder(r io.Reader, enc Encoding) (io.Reader, error) {
	switch enc {
	case UTF8:
		return transform.NewReader(r, unicode.UTF8.NewDecoder()), nil
	case UTF8M:
		return transform.NewReader(r, unicode.BOMOverride(unicode.UTF8.NewDecoder())), nil
	case UTF16:
		return transform.NewReader(r, unicode.UTF16(unicode.BigEndian, unicode.UseBOM).NewDecoder()), nil
	case UTF16BE:
		return transform.NewReader(r, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewDecoder()), nil
	case UTF16LE:
		return transform.NewReader(r, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder()), nil
	case UTF16BEM:
		return transform.NewReader(r, unicode.UTF16(unicode.BigEndian, unicode.ExpectBOM).NewDecoder()), nil
	case UTF16LEM:
		return transform.NewReader(r, unicode.UTF16(unicode.LittleEndian, unicode.ExpectBOM).NewDecoder()), nil
	case SJIS:
		return transform.NewReader(r, japanese.ShiftJIS.NewDecoder()), nil
	default:
		return nil, ErrInvalidEncoding
	}
}

// GetTransformWriter gets a writer to transform character encoding from UTF-8 to another encoding.
func GetTransformWriter(w io.Writer, enc Encoding) (io.Writer, error) {
	switch enc {
	case UTF8:
		return transform.NewWriter(w, unicode.UTF8.NewEncoder()), nil
	case UTF8M:
		return transform.NewWriter(w, NewUTF8MEncoder()), nil
	case UTF16:
		return transform.NewWriter(w, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewEncoder()), nil
	case UTF16BE:
		return transform.NewWriter(w, unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM).NewEncoder()), nil
	case UTF16LE:
		return transform.NewWriter(w, unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewEncoder()), nil
	case UTF16BEM:
		return transform.NewWriter(w, unicode.UTF16(unicode.BigEndian, unicode.ExpectBOM).NewEncoder()), nil
	case UTF16LEM:
		return transform.NewWriter(w, unicode.UTF16(unicode.LittleEndian, unicode.ExpectBOM).NewEncoder()), nil
	case SJIS:
		return transform.NewWriter(w, japanese.ShiftJIS.NewEncoder()), nil
	default:
		return nil, ErrInvalidEncoding
	}
}

// Encode a string from UTF-8 to another encoding.
func Encode(src []byte, enc Encoding) ([]byte, error) {
	r, err := GetTransformEncoder(bytes.NewReader(src), enc)
	if err != nil {
		return nil, err
	}
	return ioutil.ReadAll(r)
}

// Decode a string from any encoding to UTF-8.
func Decode(src []byte, enc Encoding) ([]byte, error) {
	r, err := GetTransformDecoder(bytes.NewReader(src), enc)
	if err != nil {
		return nil, err
	}
	return ioutil.ReadAll(r)
}

type bomPolicy uint8

const (
	writeBOM  bomPolicy = 0x01
	ignoreBOM bomPolicy = 0
)

type UTF8MEncoder struct {
	initialBOMPolicy bomPolicy
	currentBOMPolicy bomPolicy
}

func NewUTF8MEncoder() *encoding.Encoder {
	return &encoding.Encoder{Transformer: &UTF8MEncoder{
		initialBOMPolicy: writeBOM,
		currentBOMPolicy: writeBOM,
	}}
}

func (u *UTF8MEncoder) Reset() {
	u.currentBOMPolicy = u.initialBOMPolicy
}

func (u *UTF8MEncoder) Transform(dst, src []byte, atEOF bool) (nDst, nSrc int, err error) {
	if u.currentBOMPolicy&writeBOM != 0 {
		if len(dst) < 3 {
			return 0, 0, transform.ErrShortDst
		}
		bom := []byte(UTF8BOM)
		dst[0], dst[1], dst[2] = bom[0], bom[1], bom[2]
		u.currentBOMPolicy = ignoreBOM
		nDst = 3
	}

	for i := range src {
		if nDst+1 > len(dst) {
			return nDst, nSrc, transform.ErrShortDst
		}
		dst[nDst] = src[i]
		nDst++
		nSrc++
	}

	return nDst, nSrc, err
}
