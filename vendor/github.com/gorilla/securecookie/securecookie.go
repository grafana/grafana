// Copyright 2012 The Gorilla Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package securecookie

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"hash"
	"io"
	"strconv"
	"strings"
	"time"
)

// Error is the interface of all errors returned by functions in this library.
type Error interface {
	error

	// IsUsage returns true for errors indicating the client code probably
	// uses this library incorrectly.  For example, the client may have
	// failed to provide a valid hash key, or may have failed to configure
	// the Serializer adequately for encoding value.
	IsUsage() bool

	// IsDecode returns true for errors indicating that a cookie could not
	// be decoded and validated.  Since cookies are usually untrusted
	// user-provided input, errors of this type should be expected.
	// Usually, the proper action is simply to reject the request.
	IsDecode() bool

	// IsInternal returns true for unexpected errors occurring in the
	// securecookie implementation.
	IsInternal() bool

	// Cause, if it returns a non-nil value, indicates that this error was
	// propagated from some underlying library.  If this method returns nil,
	// this error was raised directly by this library.
	//
	// Cause is provided principally for debugging/logging purposes; it is
	// rare that application logic should perform meaningfully different
	// logic based on Cause.  See, for example, the caveats described on
	// (MultiError).Cause().
	Cause() error
}

// errorType is a bitmask giving the error type(s) of an cookieError value.
type errorType int

const (
	usageError = errorType(1 << iota)
	decodeError
	internalError
)

type cookieError struct {
	typ   errorType
	msg   string
	cause error
}

func (e cookieError) IsUsage() bool    { return (e.typ & usageError) != 0 }
func (e cookieError) IsDecode() bool   { return (e.typ & decodeError) != 0 }
func (e cookieError) IsInternal() bool { return (e.typ & internalError) != 0 }

func (e cookieError) Cause() error { return e.cause }

func (e cookieError) Error() string {
	parts := []string{"securecookie: "}
	if e.msg == "" {
		parts = append(parts, "error")
	} else {
		parts = append(parts, e.msg)
	}
	if c := e.Cause(); c != nil {
		parts = append(parts, " - caused by: ", c.Error())
	}
	return strings.Join(parts, "")
}

var (
	errGeneratingIV = cookieError{typ: internalError, msg: "failed to generate random iv"}

	errNoCodecs            = cookieError{typ: usageError, msg: "no codecs provided"}
	errHashKeyNotSet       = cookieError{typ: usageError, msg: "hash key is not set"}
	errBlockKeyNotSet      = cookieError{typ: usageError, msg: "block key is not set"}
	errEncodedValueTooLong = cookieError{typ: usageError, msg: "the value is too long"}

	errValueToDecodeTooLong = cookieError{typ: decodeError, msg: "the value is too long"}
	errTimestampInvalid     = cookieError{typ: decodeError, msg: "invalid timestamp"}
	errTimestampTooNew      = cookieError{typ: decodeError, msg: "timestamp is too new"}
	errTimestampExpired     = cookieError{typ: decodeError, msg: "expired timestamp"}
	errDecryptionFailed     = cookieError{typ: decodeError, msg: "the value could not be decrypted"}
	errValueNotByte         = cookieError{typ: decodeError, msg: "value not a []byte."}
	errValueNotBytePtr      = cookieError{typ: decodeError, msg: "value not a pointer to []byte."}

	// ErrMacInvalid indicates that cookie decoding failed because the HMAC
	// could not be extracted and verified.  Direct use of this error
	// variable is deprecated; it is public only for legacy compatibility,
	// and may be privatized in the future, as it is rarely useful to
	// distinguish between this error and other Error implementations.
	ErrMacInvalid = cookieError{typ: decodeError, msg: "the value is not valid"}
)

// Codec defines an interface to encode and decode cookie values.
type Codec interface {
	Encode(name string, value interface{}) (string, error)
	Decode(name, value string, dst interface{}) error
}

// New returns a new SecureCookie.
//
// hashKey is required, used to authenticate values using HMAC. Create it using
// GenerateRandomKey(). It is recommended to use a key with 32 or 64 bytes.
//
// blockKey is optional, used to encrypt values. Create it using
// GenerateRandomKey(). The key length must correspond to the block size
// of the encryption algorithm. For AES, used by default, valid lengths are
// 16, 24, or 32 bytes to select AES-128, AES-192, or AES-256.
// The default encoder used for cookie serialization is encoding/gob.
//
// Note that keys created using GenerateRandomKey() are not automatically
// persisted. New keys will be created when the application is restarted, and
// previously issued cookies will not be able to be decoded.
func New(hashKey, blockKey []byte) *SecureCookie {
	s := &SecureCookie{
		hashKey:   hashKey,
		blockKey:  blockKey,
		hashFunc:  sha256.New,
		maxAge:    86400 * 30,
		maxLength: 4096,
		sz:        GobEncoder{},
	}
	if hashKey == nil {
		s.err = errHashKeyNotSet
	}
	if blockKey != nil {
		s.BlockFunc(aes.NewCipher)
	}
	return s
}

// SecureCookie encodes and decodes authenticated and optionally encrypted
// cookie values.
type SecureCookie struct {
	hashKey   []byte
	hashFunc  func() hash.Hash
	blockKey  []byte
	block     cipher.Block
	maxLength int
	maxAge    int64
	minAge    int64
	err       error
	sz        Serializer
	// For testing purposes, the function that returns the current timestamp.
	// If not set, it will use time.Now().UTC().Unix().
	timeFunc func() int64
}

// Serializer provides an interface for providing custom serializers for cookie
// values.
type Serializer interface {
	Serialize(src interface{}) ([]byte, error)
	Deserialize(src []byte, dst interface{}) error
}

// GobEncoder encodes cookie values using encoding/gob. This is the simplest
// encoder and can handle complex types via gob.Register.
type GobEncoder struct{}

// JSONEncoder encodes cookie values using encoding/json. Users who wish to
// encode complex types need to satisfy the json.Marshaller and
// json.Unmarshaller interfaces.
type JSONEncoder struct{}

// NopEncoder does not encode cookie values, and instead simply accepts a []byte
// (as an interface{}) and returns a []byte. This is particularly useful when
// you encoding an object upstream and do not wish to re-encode it.
type NopEncoder struct{}

// MaxLength restricts the maximum length, in bytes, for the cookie value.
//
// Default is 4096, which is the maximum value accepted by Internet Explorer.
func (s *SecureCookie) MaxLength(value int) *SecureCookie {
	s.maxLength = value
	return s
}

// MaxAge restricts the maximum age, in seconds, for the cookie value.
//
// Default is 86400 * 30. Set it to 0 for no restriction.
func (s *SecureCookie) MaxAge(value int) *SecureCookie {
	s.maxAge = int64(value)
	return s
}

// MinAge restricts the minimum age, in seconds, for the cookie value.
//
// Default is 0 (no restriction).
func (s *SecureCookie) MinAge(value int) *SecureCookie {
	s.minAge = int64(value)
	return s
}

// HashFunc sets the hash function used to create HMAC.
//
// Default is crypto/sha256.New.
func (s *SecureCookie) HashFunc(f func() hash.Hash) *SecureCookie {
	s.hashFunc = f
	return s
}

// BlockFunc sets the encryption function used to create a cipher.Block.
//
// Default is crypto/aes.New.
func (s *SecureCookie) BlockFunc(f func([]byte) (cipher.Block, error)) *SecureCookie {
	if s.blockKey == nil {
		s.err = errBlockKeyNotSet
	} else if block, err := f(s.blockKey); err == nil {
		s.block = block
	} else {
		s.err = cookieError{cause: err, typ: usageError}
	}
	return s
}

// Encoding sets the encoding/serialization method for cookies.
//
// Default is encoding/gob.  To encode special structures using encoding/gob,
// they must be registered first using gob.Register().
func (s *SecureCookie) SetSerializer(sz Serializer) *SecureCookie {
	s.sz = sz

	return s
}

// Encode encodes a cookie value.
//
// It serializes, optionally encrypts, signs with a message authentication code,
// and finally encodes the value.
//
// The name argument is the cookie name. It is stored with the encoded value.
// The value argument is the value to be encoded. It can be any value that can
// be encoded using the currently selected serializer; see SetSerializer().
//
// It is the client's responsibility to ensure that value, when encoded using
// the current serialization/encryption settings on s and then base64-encoded,
// is shorter than the maximum permissible length.
func (s *SecureCookie) Encode(name string, value interface{}) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	if s.hashKey == nil {
		s.err = errHashKeyNotSet
		return "", s.err
	}
	var err error
	var b []byte
	// 1. Serialize.
	if b, err = s.sz.Serialize(value); err != nil {
		return "", cookieError{cause: err, typ: usageError}
	}
	// 2. Encrypt (optional).
	if s.block != nil {
		if b, err = encrypt(s.block, b); err != nil {
			return "", cookieError{cause: err, typ: usageError}
		}
	}
	b = encode(b)
	// 3. Create MAC for "name|date|value". Extra pipe to be used later.
	b = []byte(fmt.Sprintf("%s|%d|%s|", name, s.timestamp(), b))
	mac := createMac(hmac.New(s.hashFunc, s.hashKey), b[:len(b)-1])
	// Append mac, remove name.
	b = append(b, mac...)[len(name)+1:]
	// 4. Encode to base64.
	b = encode(b)
	// 5. Check length.
	if s.maxLength != 0 && len(b) > s.maxLength {
		return "", errEncodedValueTooLong
	}
	// Done.
	return string(b), nil
}

// Decode decodes a cookie value.
//
// It decodes, verifies a message authentication code, optionally decrypts and
// finally deserializes the value.
//
// The name argument is the cookie name. It must be the same name used when
// it was stored. The value argument is the encoded cookie value. The dst
// argument is where the cookie will be decoded. It must be a pointer.
func (s *SecureCookie) Decode(name, value string, dst interface{}) error {
	if s.err != nil {
		return s.err
	}
	if s.hashKey == nil {
		s.err = errHashKeyNotSet
		return s.err
	}
	// 1. Check length.
	if s.maxLength != 0 && len(value) > s.maxLength {
		return errValueToDecodeTooLong
	}
	// 2. Decode from base64.
	b, err := decode([]byte(value))
	if err != nil {
		return err
	}
	// 3. Verify MAC. Value is "date|value|mac".
	parts := bytes.SplitN(b, []byte("|"), 3)
	if len(parts) != 3 {
		return ErrMacInvalid
	}
	h := hmac.New(s.hashFunc, s.hashKey)
	b = append([]byte(name+"|"), b[:len(b)-len(parts[2])-1]...)
	if err = verifyMac(h, b, parts[2]); err != nil {
		return err
	}
	// 4. Verify date ranges.
	var t1 int64
	if t1, err = strconv.ParseInt(string(parts[0]), 10, 64); err != nil {
		return errTimestampInvalid
	}
	t2 := s.timestamp()
	if s.minAge != 0 && t1 > t2-s.minAge {
		return errTimestampTooNew
	}
	if s.maxAge != 0 && t1 < t2-s.maxAge {
		return errTimestampExpired
	}
	// 5. Decrypt (optional).
	b, err = decode(parts[1])
	if err != nil {
		return err
	}
	if s.block != nil {
		if b, err = decrypt(s.block, b); err != nil {
			return err
		}
	}
	// 6. Deserialize.
	if err = s.sz.Deserialize(b, dst); err != nil {
		return cookieError{cause: err, typ: decodeError}
	}
	// Done.
	return nil
}

// timestamp returns the current timestamp, in seconds.
//
// For testing purposes, the function that generates the timestamp can be
// overridden. If not set, it will return time.Now().UTC().Unix().
func (s *SecureCookie) timestamp() int64 {
	if s.timeFunc == nil {
		return time.Now().UTC().Unix()
	}
	return s.timeFunc()
}

// Authentication -------------------------------------------------------------

// createMac creates a message authentication code (MAC).
func createMac(h hash.Hash, value []byte) []byte {
	h.Write(value)
	return h.Sum(nil)
}

// verifyMac verifies that a message authentication code (MAC) is valid.
func verifyMac(h hash.Hash, value []byte, mac []byte) error {
	mac2 := createMac(h, value)
	// Check that both MACs are of equal length, as subtle.ConstantTimeCompare
	// does not do this prior to Go 1.4.
	if len(mac) == len(mac2) && subtle.ConstantTimeCompare(mac, mac2) == 1 {
		return nil
	}
	return ErrMacInvalid
}

// Encryption -----------------------------------------------------------------

// encrypt encrypts a value using the given block in counter mode.
//
// A random initialization vector (http://goo.gl/zF67k) with the length of the
// block size is prepended to the resulting ciphertext.
func encrypt(block cipher.Block, value []byte) ([]byte, error) {
	iv := GenerateRandomKey(block.BlockSize())
	if iv == nil {
		return nil, errGeneratingIV
	}
	// Encrypt it.
	stream := cipher.NewCTR(block, iv)
	stream.XORKeyStream(value, value)
	// Return iv + ciphertext.
	return append(iv, value...), nil
}

// decrypt decrypts a value using the given block in counter mode.
//
// The value to be decrypted must be prepended by a initialization vector
// (http://goo.gl/zF67k) with the length of the block size.
func decrypt(block cipher.Block, value []byte) ([]byte, error) {
	size := block.BlockSize()
	if len(value) > size {
		// Extract iv.
		iv := value[:size]
		// Extract ciphertext.
		value = value[size:]
		// Decrypt it.
		stream := cipher.NewCTR(block, iv)
		stream.XORKeyStream(value, value)
		return value, nil
	}
	return nil, errDecryptionFailed
}

// Serialization --------------------------------------------------------------

// Serialize encodes a value using gob.
func (e GobEncoder) Serialize(src interface{}) ([]byte, error) {
	buf := new(bytes.Buffer)
	enc := gob.NewEncoder(buf)
	if err := enc.Encode(src); err != nil {
		return nil, cookieError{cause: err, typ: usageError}
	}
	return buf.Bytes(), nil
}

// Deserialize decodes a value using gob.
func (e GobEncoder) Deserialize(src []byte, dst interface{}) error {
	dec := gob.NewDecoder(bytes.NewBuffer(src))
	if err := dec.Decode(dst); err != nil {
		return cookieError{cause: err, typ: decodeError}
	}
	return nil
}

// Serialize encodes a value using encoding/json.
func (e JSONEncoder) Serialize(src interface{}) ([]byte, error) {
	buf := new(bytes.Buffer)
	enc := json.NewEncoder(buf)
	if err := enc.Encode(src); err != nil {
		return nil, cookieError{cause: err, typ: usageError}
	}
	return buf.Bytes(), nil
}

// Deserialize decodes a value using encoding/json.
func (e JSONEncoder) Deserialize(src []byte, dst interface{}) error {
	dec := json.NewDecoder(bytes.NewReader(src))
	if err := dec.Decode(dst); err != nil {
		return cookieError{cause: err, typ: decodeError}
	}
	return nil
}

// Serialize passes a []byte through as-is.
func (e NopEncoder) Serialize(src interface{}) ([]byte, error) {
	if b, ok := src.([]byte); ok {
		return b, nil
	}

	return nil, errValueNotByte
}

// Deserialize passes a []byte through as-is.
func (e NopEncoder) Deserialize(src []byte, dst interface{}) error {
	if dat, ok := dst.(*[]byte); ok {
		*dat = src
		return nil
	}
	return errValueNotBytePtr
}

// Encoding -------------------------------------------------------------------

// encode encodes a value using base64.
func encode(value []byte) []byte {
	encoded := make([]byte, base64.URLEncoding.EncodedLen(len(value)))
	base64.URLEncoding.Encode(encoded, value)
	return encoded
}

// decode decodes a cookie using base64.
func decode(value []byte) ([]byte, error) {
	decoded := make([]byte, base64.URLEncoding.DecodedLen(len(value)))
	b, err := base64.URLEncoding.Decode(decoded, value)
	if err != nil {
		return nil, cookieError{cause: err, typ: decodeError, msg: "base64 decode failed"}
	}
	return decoded[:b], nil
}

// Helpers --------------------------------------------------------------------

// GenerateRandomKey creates a random key with the given length in bytes.
// On failure, returns nil.
//
// Callers should explicitly check for the possibility of a nil return, treat
// it as a failure of the system random number generator, and not continue.
func GenerateRandomKey(length int) []byte {
	k := make([]byte, length)
	if _, err := io.ReadFull(rand.Reader, k); err != nil {
		return nil
	}
	return k
}

// CodecsFromPairs returns a slice of SecureCookie instances.
//
// It is a convenience function to create a list of codecs for key rotation. Note
// that the generated Codecs will have the default options applied: callers
// should iterate over each Codec and type-assert the underlying *SecureCookie to
// change these.
//
// Example:
//
//      codecs := securecookie.CodecsFromPairs(
//           []byte("new-hash-key"),
//           []byte("new-block-key"),
//           []byte("old-hash-key"),
//           []byte("old-block-key"),
//       )
//
//      // Modify each instance.
//      for _, s := range codecs {
//             if cookie, ok := s.(*securecookie.SecureCookie); ok {
//                 cookie.MaxAge(86400 * 7)
//                 cookie.SetSerializer(securecookie.JSONEncoder{})
//                 cookie.HashFunc(sha512.New512_256)
//             }
//         }
//
func CodecsFromPairs(keyPairs ...[]byte) []Codec {
	codecs := make([]Codec, len(keyPairs)/2+len(keyPairs)%2)
	for i := 0; i < len(keyPairs); i += 2 {
		var blockKey []byte
		if i+1 < len(keyPairs) {
			blockKey = keyPairs[i+1]
		}
		codecs[i/2] = New(keyPairs[i], blockKey)
	}
	return codecs
}

// EncodeMulti encodes a cookie value using a group of codecs.
//
// The codecs are tried in order. Multiple codecs are accepted to allow
// key rotation.
//
// On error, may return a MultiError.
func EncodeMulti(name string, value interface{}, codecs ...Codec) (string, error) {
	if len(codecs) == 0 {
		return "", errNoCodecs
	}

	var errors MultiError
	for _, codec := range codecs {
		encoded, err := codec.Encode(name, value)
		if err == nil {
			return encoded, nil
		}
		errors = append(errors, err)
	}
	return "", errors
}

// DecodeMulti decodes a cookie value using a group of codecs.
//
// The codecs are tried in order. Multiple codecs are accepted to allow
// key rotation.
//
// On error, may return a MultiError.
func DecodeMulti(name string, value string, dst interface{}, codecs ...Codec) error {
	if len(codecs) == 0 {
		return errNoCodecs
	}

	var errors MultiError
	for _, codec := range codecs {
		err := codec.Decode(name, value, dst)
		if err == nil {
			return nil
		}
		errors = append(errors, err)
	}
	return errors
}

// MultiError groups multiple errors.
type MultiError []error

func (m MultiError) IsUsage() bool    { return m.any(func(e Error) bool { return e.IsUsage() }) }
func (m MultiError) IsDecode() bool   { return m.any(func(e Error) bool { return e.IsDecode() }) }
func (m MultiError) IsInternal() bool { return m.any(func(e Error) bool { return e.IsInternal() }) }

// Cause returns nil for MultiError; there is no unique underlying cause in the
// general case.
//
// Note: we could conceivably return a non-nil Cause only when there is exactly
// one child error with a Cause.  However, it would be brittle for client code
// to rely on the arity of causes inside a MultiError, so we have opted not to
// provide this functionality.  Clients which really wish to access the Causes
// of the underlying errors are free to iterate through the errors themselves.
func (m MultiError) Cause() error { return nil }

func (m MultiError) Error() string {
	s, n := "", 0
	for _, e := range m {
		if e != nil {
			if n == 0 {
				s = e.Error()
			}
			n++
		}
	}
	switch n {
	case 0:
		return "(0 errors)"
	case 1:
		return s
	case 2:
		return s + " (and 1 other error)"
	}
	return fmt.Sprintf("%s (and %d other errors)", s, n-1)
}

// any returns true if any element of m is an Error for which pred returns true.
func (m MultiError) any(pred func(Error) bool) bool {
	for _, e := range m {
		if ourErr, ok := e.(Error); ok && pred(ourErr) {
			return true
		}
	}
	return false
}
