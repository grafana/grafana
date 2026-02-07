package base64

import (
	"encoding/base64"
)

const (
	StdPadding rune = base64.StdPadding
	NoPadding  rune = base64.NoPadding

	encodeStd  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	encodeURL  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	encodeIMAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+,"

	letterRange = int8('Z' - 'A' + 1)
)

// StdEncoding is the standard base64 encoding, as defined in RFC 4648.
var StdEncoding = NewEncoding(encodeStd)

// URLEncoding is the alternate base64 encoding defined in RFC 4648.
// It is typically used in URLs and file names.
var URLEncoding = NewEncoding(encodeURL)

// RawStdEncoding is the standard unpadded base64 encoding defined in RFC 4648 section 3.2.
// This is the same as StdEncoding but omits padding characters.
var RawStdEncoding = StdEncoding.WithPadding(NoPadding)

// RawURLEncoding is the unpadded alternate base64 encoding defined in RFC 4648.
// This is the same as URLEncoding but omits padding characters.
var RawURLEncoding = URLEncoding.WithPadding(NoPadding)

// NewEncoding returns a new padded Encoding defined by the given alphabet,
// which must be a 64-byte string that does not contain the padding character
// or CR / LF ('\r', '\n'). Unlike the standard library, the encoding alphabet
// cannot be abitrary, and it must follow one of the know standard encoding
// variants.
//
// Required alphabet values:
//     * [0,26):  characters 'A'..'Z'
//     * [26,52): characters 'a'..'z'
//     * [52,62): characters '0'..'9'
// Flexible alphabet value options:
//     * RFC 4648, RFC 1421, RFC 2045, RFC 2152, RFC 4880: '+' and '/'
//     * RFC 4648 URI: '-' and '_'
//     * RFC 3501: '+' and ','
//
// The resulting Encoding uses the default padding character ('='), which may
// be changed or disabled via WithPadding. The padding characters is urestricted,
// but it must be a character outside of the encoder alphabet.
func NewEncoding(encoder string) *Encoding {
	if len(encoder) != 64 {
		panic("encoding alphabet is not 64-bytes long")
	}

	if _, ok := allowedEncoding[encoder]; !ok {
		panic("non-standard encoding alphabets are not supported")
	}

	return newEncoding(encoder)
}

var allowedEncoding = map[string]struct{}{
	encodeStd:  {},
	encodeURL:  {},
	encodeIMAP: {},
}
