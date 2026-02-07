package checksum

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"hash"
	"hash/crc32"
	"hash/crc64"
	"io"
	"strings"
	"sync"
)

// Algorithm represents the checksum algorithms supported
type Algorithm string

// Enumeration values for supported checksum Algorithms.
const (
	// AlgorithmCRC32C represents CRC32C hash algorithm
	AlgorithmCRC32C Algorithm = "CRC32C"

	// AlgorithmCRC32 represents CRC32 hash algorithm
	AlgorithmCRC32 Algorithm = "CRC32"

	// AlgorithmSHA1 represents SHA1 hash algorithm
	AlgorithmSHA1 Algorithm = "SHA1"

	// AlgorithmSHA256 represents SHA256 hash algorithm
	AlgorithmSHA256 Algorithm = "SHA256"

	// AlgorithmCRC64NVME represents CRC64NVME hash algorithm
	AlgorithmCRC64NVME Algorithm = "CRC64NVME"
)

// inverted NVME polynomial as required by crc64.MakeTable
const crc64NVME = 0x9a6c_9329_ac4b_c9b5

var supportedAlgorithms = []Algorithm{
	AlgorithmCRC32C,
	AlgorithmCRC32,
	AlgorithmSHA1,
	AlgorithmSHA256,
	AlgorithmCRC64NVME,
}

func (a Algorithm) String() string { return string(a) }

// ParseAlgorithm attempts to parse the provided value into a checksum
// algorithm, matching without case. Returns the algorithm matched, or an error
// if the algorithm wasn't matched.
func ParseAlgorithm(v string) (Algorithm, error) {
	for _, a := range supportedAlgorithms {
		if strings.EqualFold(string(a), v) {
			return a, nil
		}
	}
	return "", fmt.Errorf("unknown checksum algorithm, %v", v)
}

// FilterSupportedAlgorithms filters the set of algorithms, returning a slice
// of algorithms that are supported.
func FilterSupportedAlgorithms(vs []string) []Algorithm {
	found := map[Algorithm]struct{}{}

	supported := make([]Algorithm, 0, len(supportedAlgorithms))
	for _, v := range vs {
		for _, a := range supportedAlgorithms {
			// Only consider algorithms that are supported
			if !strings.EqualFold(v, string(a)) {
				continue
			}
			// Ignore duplicate algorithms in list.
			if _, ok := found[a]; ok {
				continue
			}

			supported = append(supported, a)
			found[a] = struct{}{}
		}
	}
	return supported
}

// NewAlgorithmHash returns a hash.Hash for the checksum algorithm. Error is
// returned if the algorithm is unknown.
func NewAlgorithmHash(v Algorithm) (hash.Hash, error) {
	switch v {
	case AlgorithmSHA1:
		return sha1.New(), nil
	case AlgorithmSHA256:
		return sha256.New(), nil
	case AlgorithmCRC32:
		return crc32.NewIEEE(), nil
	case AlgorithmCRC32C:
		return crc32.New(crc32.MakeTable(crc32.Castagnoli)), nil
	case AlgorithmCRC64NVME:
		return crc64.New(crc64.MakeTable(crc64NVME)), nil
	default:
		return nil, fmt.Errorf("unknown checksum algorithm, %v", v)
	}
}

// AlgorithmChecksumLength returns the length of the algorithm's checksum in
// bytes. If the algorithm is not known, an error is returned.
func AlgorithmChecksumLength(v Algorithm) (int, error) {
	switch v {
	case AlgorithmSHA1:
		return sha1.Size, nil
	case AlgorithmSHA256:
		return sha256.Size, nil
	case AlgorithmCRC32:
		return crc32.Size, nil
	case AlgorithmCRC32C:
		return crc32.Size, nil
	case AlgorithmCRC64NVME:
		return crc64.Size, nil
	default:
		return 0, fmt.Errorf("unknown checksum algorithm, %v", v)
	}
}

const awsChecksumHeaderPrefix = "x-amz-checksum-"

// AlgorithmHTTPHeader returns the HTTP header for the algorithm's hash.
func AlgorithmHTTPHeader(v Algorithm) string {
	return awsChecksumHeaderPrefix + strings.ToLower(string(v))
}

// base64EncodeHashSum computes base64 encoded checksum of a given running
// hash. The running hash must already have content written to it. Returns the
// byte slice of checksum and an error
func base64EncodeHashSum(h hash.Hash) []byte {
	sum := h.Sum(nil)
	sum64 := make([]byte, base64.StdEncoding.EncodedLen(len(sum)))
	base64.StdEncoding.Encode(sum64, sum)
	return sum64
}

// hexEncodeHashSum computes hex encoded checksum of a given running hash. The
// running hash must already have content written to it. Returns the byte slice
// of checksum and an error
func hexEncodeHashSum(h hash.Hash) []byte {
	sum := h.Sum(nil)
	sumHex := make([]byte, hex.EncodedLen(len(sum)))
	hex.Encode(sumHex, sum)
	return sumHex
}

// computeMD5Checksum computes base64 MD5 checksum of an io.Reader's contents.
// Returns the byte slice of MD5 checksum and an error.
func computeMD5Checksum(r io.Reader) ([]byte, error) {
	h := md5.New()

	// Copy errors may be assumed to be from the body.
	if _, err := io.Copy(h, r); err != nil {
		return nil, fmt.Errorf("failed compute MD5 hash of reader, %w", err)
	}

	// Encode the MD5 checksum in base64.
	return base64EncodeHashSum(h), nil
}

// computeChecksumReader provides a reader wrapping an underlying io.Reader to
// compute the checksum of the stream's bytes.
type computeChecksumReader struct {
	stream            io.Reader
	algorithm         Algorithm
	hasher            hash.Hash
	base64ChecksumLen int

	mux            sync.RWMutex
	lockedChecksum string
	lockedErr      error
}

// newComputeChecksumReader returns a computeChecksumReader for the stream and
// algorithm specified. Returns error if unable to create the reader, or
// algorithm is unknown.
func newComputeChecksumReader(stream io.Reader, algorithm Algorithm) (*computeChecksumReader, error) {
	hasher, err := NewAlgorithmHash(algorithm)
	if err != nil {
		return nil, err
	}

	checksumLength, err := AlgorithmChecksumLength(algorithm)
	if err != nil {
		return nil, err
	}

	return &computeChecksumReader{
		stream:            io.TeeReader(stream, hasher),
		algorithm:         algorithm,
		hasher:            hasher,
		base64ChecksumLen: base64.StdEncoding.EncodedLen(checksumLength),
	}, nil
}

// Read wraps the underlying reader. When the underlying reader returns EOF,
// the checksum of the reader will be computed, and can be retrieved with
// ChecksumBase64String.
func (r *computeChecksumReader) Read(p []byte) (int, error) {
	n, err := r.stream.Read(p)
	if err == nil {
		return n, nil
	} else if err != io.EOF {
		r.mux.Lock()
		defer r.mux.Unlock()

		r.lockedErr = err
		return n, err
	}

	b := base64EncodeHashSum(r.hasher)

	r.mux.Lock()
	defer r.mux.Unlock()

	r.lockedChecksum = string(b)

	return n, err
}

func (r *computeChecksumReader) Algorithm() Algorithm {
	return r.algorithm
}

// Base64ChecksumLength returns the base64 encoded length of the checksum for
// algorithm.
func (r *computeChecksumReader) Base64ChecksumLength() int {
	return r.base64ChecksumLen
}

// Base64Checksum returns the base64 checksum for the algorithm, or error if
// the underlying reader returned a non-EOF error.
//
// Safe to be called concurrently, but will return an error until after the
// underlying reader is returns EOF.
func (r *computeChecksumReader) Base64Checksum() (string, error) {
	r.mux.RLock()
	defer r.mux.RUnlock()

	if r.lockedErr != nil {
		return "", r.lockedErr
	}

	if r.lockedChecksum == "" {
		return "", fmt.Errorf(
			"checksum not available yet, called before reader returns EOF",
		)
	}

	return r.lockedChecksum, nil
}

// validateChecksumReader implements io.ReadCloser interface. The wrapper
// performs checksum validation when the underlying reader has been fully read.
type validateChecksumReader struct {
	originalBody   io.ReadCloser
	body           io.Reader
	hasher         hash.Hash
	algorithm      Algorithm
	expectChecksum string
}

// newValidateChecksumReader returns a configured io.ReadCloser that performs
// checksum validation when the underlying reader has been fully read.
func newValidateChecksumReader(
	body io.ReadCloser,
	algorithm Algorithm,
	expectChecksum string,
) (*validateChecksumReader, error) {
	hasher, err := NewAlgorithmHash(algorithm)
	if err != nil {
		return nil, err
	}

	return &validateChecksumReader{
		originalBody:   body,
		body:           io.TeeReader(body, hasher),
		hasher:         hasher,
		algorithm:      algorithm,
		expectChecksum: expectChecksum,
	}, nil
}

// Read attempts to read from the underlying stream while also updating the
// running hash. If the underlying stream returns with an EOF error, the
// checksum of the stream will be collected, and compared against the expected
// checksum. If the checksums do not match, an error will be returned.
//
// If a non-EOF error occurs when reading the underlying stream, that error
// will be returned and the checksum for the stream will be discarded.
func (c *validateChecksumReader) Read(p []byte) (n int, err error) {
	n, err = c.body.Read(p)
	if err == io.EOF {
		if checksumErr := c.validateChecksum(); checksumErr != nil {
			return n, checksumErr
		}
	}

	return n, err
}

// Close closes the underlying reader, returning any error that occurred in the
// underlying reader.
func (c *validateChecksumReader) Close() (err error) {
	return c.originalBody.Close()
}

func (c *validateChecksumReader) validateChecksum() error {
	// Compute base64 encoded checksum hash of the payload's read bytes.
	v := base64EncodeHashSum(c.hasher)
	if e, a := c.expectChecksum, string(v); !strings.EqualFold(e, a) {
		return validationError{
			Algorithm: c.algorithm, Expect: e, Actual: a,
		}
	}

	return nil
}

type validationError struct {
	Algorithm Algorithm
	Expect    string
	Actual    string
}

func (v validationError) Error() string {
	return fmt.Sprintf("checksum did not match: algorithm %v, expect %v, actual %v",
		v.Algorithm, v.Expect, v.Actual)
}
