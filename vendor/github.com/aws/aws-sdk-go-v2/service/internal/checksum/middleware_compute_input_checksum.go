package checksum

import (
	"context"
	"crypto/sha256"
	"fmt"
	"hash"
	"io"
	"strconv"
	"strings"

	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"
	presignedurlcust "github.com/aws/aws-sdk-go-v2/service/internal/presigned-url"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

const (
	streamingUnsignedPayloadTrailerPayloadHash = "STREAMING-UNSIGNED-PAYLOAD-TRAILER"
)

// computedInputChecksumsKey is the metadata key for recording the algorithm the
// checksum was computed for and the checksum value.
type computedInputChecksumsKey struct{}

// GetComputedInputChecksums returns the map of checksum algorithm to their
// computed value stored in the middleware Metadata. Returns false if no values
// were stored in the Metadata.
func GetComputedInputChecksums(m middleware.Metadata) (map[string]string, bool) {
	vs, ok := m.Get(computedInputChecksumsKey{}).(map[string]string)
	return vs, ok
}

// SetComputedInputChecksums stores the map of checksum algorithm to their
// computed value in the middleware Metadata. Overwrites any values that
// currently exist in the metadata.
func SetComputedInputChecksums(m *middleware.Metadata, vs map[string]string) {
	m.Set(computedInputChecksumsKey{}, vs)
}

// ComputeInputPayloadChecksum middleware computes payload checksum
type ComputeInputPayloadChecksum struct {
	// Enables support for wrapping the serialized input payload with a
	// content-encoding: aws-check wrapper, and including a trailer for the
	// algorithm's checksum value.
	//
	// The checksum will not be computed, nor added as trailing checksum, if
	// the Algorithm's header is already set on the request.
	EnableTrailingChecksum bool

	// Enables support for computing the SHA256 checksum of input payloads
	// along with the algorithm specified checksum. Prevents downstream
	// middleware handlers (computePayloadSHA256) re-reading the payload.
	//
	// The SHA256 payload hash will only be used for computed for requests
	// that are not TLS, or do not enable trailing checksums.
	//
	// The SHA256 payload hash will not be computed, if the Algorithm's header
	// is already set on the request.
	EnableComputePayloadHash bool

	// Enables support for setting the aws-chunked decoded content length
	// header for the decoded length of the underlying stream. Will only be set
	// when used with trailing checksums, and aws-chunked content-encoding.
	EnableDecodedContentLengthHeader bool

	useTrailer bool
}

type useTrailer struct{}

// ID provides the middleware's identifier.
func (m *ComputeInputPayloadChecksum) ID() string {
	return "AWSChecksum:ComputeInputPayloadChecksum"
}

type computeInputHeaderChecksumError struct {
	Msg string
	Err error
}

func (e computeInputHeaderChecksumError) Error() string {
	const intro = "compute input header checksum failed"

	if e.Err != nil {
		return fmt.Sprintf("%s, %s, %v", intro, e.Msg, e.Err)
	}

	return fmt.Sprintf("%s, %s", intro, e.Msg)
}
func (e computeInputHeaderChecksumError) Unwrap() error { return e.Err }

// HandleFinalize handles computing the payload's checksum, in the following cases:
//   - Is HTTP, not HTTPS
//   - RequireChecksum is true, and no checksums were specified via the Input
//   - Trailing checksums are not supported
//
// The build handler must be inserted in the stack before ContentPayloadHash
// and after ComputeContentLength.
func (m *ComputeInputPayloadChecksum) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	var checksum string
	algorithm, ok, err := getInputAlgorithm(ctx)
	if err != nil {
		return out, metadata, err
	}
	if !ok {
		return next.HandleFinalize(ctx, in)
	}

	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, computeInputHeaderChecksumError{
			Msg: fmt.Sprintf("unknown request type %T", req),
		}
	}

	defer func() {
		if algorithm == "" || checksum == "" || err != nil {
			return
		}

		// Record the checksum and algorithm that was computed
		SetComputedInputChecksums(&metadata, map[string]string{
			string(algorithm): checksum,
		})
	}()

	// If any checksum header is already set nothing to do.
	for header := range req.Header {
		h := strings.ToUpper(header)
		if strings.HasPrefix(h, "X-AMZ-CHECKSUM-") {
			algorithm = Algorithm(strings.TrimPrefix(h, "X-AMZ-CHECKSUM-"))
			checksum = req.Header.Get(header)
			return next.HandleFinalize(ctx, in)
		}
	}

	computePayloadHash := m.EnableComputePayloadHash
	if v := v4.GetPayloadHash(ctx); v != "" {
		computePayloadHash = false
	}

	stream := req.GetStream()
	streamLength, err := getRequestStreamLength(req)
	if err != nil {
		return out, metadata, computeInputHeaderChecksumError{
			Msg: "failed to determine stream length",
			Err: err,
		}
	}

	// If trailing checksums are supported, the request is HTTPS, and the
	// stream is not nil or empty, instead switch to a trailing checksum.
	//
	// Nil and empty streams will always be handled as a request header,
	// regardless if the operation supports trailing checksums or not.
	if req.IsHTTPS() && !presignedurlcust.GetIsPresigning(ctx) {
		if stream != nil && streamLength != 0 && m.EnableTrailingChecksum {
			if m.EnableComputePayloadHash {
				// ContentSHA256Header middleware handles the header
				ctx = v4.SetPayloadHash(ctx, streamingUnsignedPayloadTrailerPayloadHash)
			}
			m.useTrailer = true
			ctx = middleware.WithStackValue(ctx, useTrailer{}, true)
			return next.HandleFinalize(ctx, in)
		}

		// If trailing checksums are not enabled but protocol is still HTTPS
		// disabling computing the payload hash. Downstream middleware  handler
		// (ComputetPayloadHash) will set the payload hash to unsigned payload,
		// if signing was used.
		computePayloadHash = false
	}

	// Only seekable streams are supported for non-trailing checksums, because
	// the stream needs to be rewound before the handler can continue.
	if stream != nil && !req.IsStreamSeekable() {
		return out, metadata, computeInputHeaderChecksumError{
			Msg: "unseekable stream is not supported without TLS and trailing checksum",
		}
	}

	var sha256Checksum string
	checksum, sha256Checksum, err = computeStreamChecksum(
		algorithm, stream, computePayloadHash)
	if err != nil {
		return out, metadata, computeInputHeaderChecksumError{
			Msg: "failed to compute stream checksum",
			Err: err,
		}
	}

	if err := req.RewindStream(); err != nil {
		return out, metadata, computeInputHeaderChecksumError{
			Msg: "failed to rewind stream",
			Err: err,
		}
	}

	checksumHeader := AlgorithmHTTPHeader(algorithm)
	req.Header.Set(checksumHeader, checksum)

	if computePayloadHash {
		ctx = v4.SetPayloadHash(ctx, sha256Checksum)
	}

	return next.HandleFinalize(ctx, in)
}

type computeInputTrailingChecksumError struct {
	Msg string
	Err error
}

func (e computeInputTrailingChecksumError) Error() string {
	const intro = "compute input trailing checksum failed"

	if e.Err != nil {
		return fmt.Sprintf("%s, %s, %v", intro, e.Msg, e.Err)
	}

	return fmt.Sprintf("%s, %s", intro, e.Msg)
}
func (e computeInputTrailingChecksumError) Unwrap() error { return e.Err }

// AddInputChecksumTrailer adds HTTP checksum when
//   - Is HTTPS, not HTTP
//   - A checksum was specified via the Input
//   - Trailing checksums are supported.
type AddInputChecksumTrailer struct {
	EnableTrailingChecksum           bool
	EnableComputePayloadHash         bool
	EnableDecodedContentLengthHeader bool
}

// ID identifies this middleware.
func (*AddInputChecksumTrailer) ID() string {
	return "addInputChecksumTrailer"
}

// HandleFinalize wraps the request body to write the trailing checksum.
func (m *AddInputChecksumTrailer) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	algorithm, ok, err := getInputAlgorithm(ctx)
	if err != nil {
		return out, metadata, computeInputTrailingChecksumError{
			Msg: "failed to get algorithm",
			Err: err,
		}
	} else if !ok {
		return next.HandleFinalize(ctx, in)
	}

	if enabled, _ := middleware.GetStackValue(ctx, useTrailer{}).(bool); !enabled {
		return next.HandleFinalize(ctx, in)
	}
	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, computeInputTrailingChecksumError{
			Msg: fmt.Sprintf("unknown request type %T", req),
		}
	}

	// Trailing checksums are only supported when TLS is enabled.
	if !req.IsHTTPS() {
		return out, metadata, computeInputTrailingChecksumError{
			Msg: "HTTPS required",
		}
	}

	// If any checksum header is already set nothing to do.
	for header := range req.Header {
		if strings.HasPrefix(strings.ToLower(header), "x-amz-checksum-") {
			return next.HandleFinalize(ctx, in)
		}
	}

	stream := req.GetStream()
	streamLength, err := getRequestStreamLength(req)
	if err != nil {
		return out, metadata, computeInputTrailingChecksumError{
			Msg: "failed to determine stream length",
			Err: err,
		}
	}

	if stream == nil || streamLength == 0 {
		// Nil and empty streams are handled by the Build handler. They are not
		// supported by the trailing checksums finalize handler. There is no
		// benefit to sending them as trailers compared to headers.
		return out, metadata, computeInputTrailingChecksumError{
			Msg: "nil or empty streams are not supported",
		}
	}

	checksumReader, err := newComputeChecksumReader(stream, algorithm)
	if err != nil {
		return out, metadata, computeInputTrailingChecksumError{
			Msg: "failed to created checksum reader",
			Err: err,
		}
	}

	awsChunkedReader := newUnsignedAWSChunkedEncoding(checksumReader,
		func(o *awsChunkedEncodingOptions) {
			o.Trailers[AlgorithmHTTPHeader(checksumReader.Algorithm())] = awsChunkedTrailerValue{
				Get:    checksumReader.Base64Checksum,
				Length: checksumReader.Base64ChecksumLength(),
			}
			o.StreamLength = streamLength
		})

	for key, values := range awsChunkedReader.HTTPHeaders() {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// Setting the stream on the request will create a copy. The content length
	// is not updated until after the request is copied to prevent impacting
	// upstream middleware.
	req, err = req.SetStream(awsChunkedReader)
	if err != nil {
		return out, metadata, computeInputTrailingChecksumError{
			Msg: "failed updating request to trailing checksum wrapped stream",
			Err: err,
		}
	}
	req.ContentLength = awsChunkedReader.EncodedLength()
	in.Request = req

	// Add decoded content length header if original stream's content length is known.
	if streamLength != -1 && m.EnableDecodedContentLengthHeader {
		req.Header.Set(decodedContentLengthHeaderName, strconv.FormatInt(streamLength, 10))
	}

	out, metadata, err = next.HandleFinalize(ctx, in)
	if err == nil {
		checksum, err := checksumReader.Base64Checksum()
		if err != nil {
			return out, metadata, fmt.Errorf("failed to get computed checksum, %w", err)
		}

		// Record the checksum and algorithm that was computed
		SetComputedInputChecksums(&metadata, map[string]string{
			string(algorithm): checksum,
		})
	}

	return out, metadata, err
}

func getInputAlgorithm(ctx context.Context) (Algorithm, bool, error) {
	ctxAlgorithm := internalcontext.GetChecksumInputAlgorithm(ctx)
	if ctxAlgorithm == "" {
		return "", false, nil
	}

	algorithm, err := ParseAlgorithm(ctxAlgorithm)
	if err != nil {
		return "", false, fmt.Errorf(
			"failed to parse algorithm, %w", err)
	}

	return algorithm, true, nil
}

func computeStreamChecksum(algorithm Algorithm, stream io.Reader, computePayloadHash bool) (
	checksum string, sha256Checksum string, err error,
) {
	hasher, err := NewAlgorithmHash(algorithm)
	if err != nil {
		return "", "", fmt.Errorf(
			"failed to get hasher for checksum algorithm, %w", err)
	}

	var sha256Hasher hash.Hash
	var batchHasher io.Writer = hasher

	// Compute payload hash for the protocol. To prevent another handler
	// (computePayloadSHA256) re-reading body also compute the SHA256 for
	// request signing. If configured checksum algorithm is SHA256, don't
	// double wrap stream with another SHA256 hasher.
	if computePayloadHash && algorithm != AlgorithmSHA256 {
		sha256Hasher = sha256.New()
		batchHasher = io.MultiWriter(hasher, sha256Hasher)
	}

	if stream != nil {
		if _, err = io.Copy(batchHasher, stream); err != nil {
			return "", "", fmt.Errorf(
				"failed to read stream to compute hash, %w", err)
		}
	}

	checksum = string(base64EncodeHashSum(hasher))
	if computePayloadHash {
		if algorithm != AlgorithmSHA256 {
			sha256Checksum = string(hexEncodeHashSum(sha256Hasher))
		} else {
			sha256Checksum = string(hexEncodeHashSum(hasher))
		}
	}

	return checksum, sha256Checksum, nil
}

func getRequestStreamLength(req *smithyhttp.Request) (int64, error) {
	if v := req.ContentLength; v > 0 {
		return v, nil
	}

	if length, ok, err := req.StreamLength(); err != nil {
		return 0, fmt.Errorf("failed getting request stream's length, %w", err)
	} else if ok {
		return length, nil
	}

	return -1, nil
}
