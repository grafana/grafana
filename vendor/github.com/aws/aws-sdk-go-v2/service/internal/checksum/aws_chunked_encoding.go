package checksum

import (
	"bytes"
	"fmt"
	"io"
	"strconv"
	"strings"
)

const (
	crlf = "\r\n"

	// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-streaming.html
	defaultChunkLength = 1024 * 64

	awsTrailerHeaderName           = "x-amz-trailer"
	decodedContentLengthHeaderName = "x-amz-decoded-content-length"

	contentEncodingHeaderName            = "content-encoding"
	awsChunkedContentEncodingHeaderValue = "aws-chunked"

	trailerKeyValueSeparator = ":"
)

var (
	crlfBytes       = []byte(crlf)
	finalChunkBytes = []byte("0" + crlf)
)

type awsChunkedEncodingOptions struct {
	// The total size of the stream. For unsigned encoding this implies that
	// there will only be a single chunk containing the underlying payload,
	// unless ChunkLength is also specified.
	StreamLength int64

	// Set of trailer key:value pairs that will be appended to the end of the
	// payload after the end chunk has been written.
	Trailers map[string]awsChunkedTrailerValue

	// The maximum size of each chunk to be sent. Default value of -1, signals
	// that optimal chunk length will be used automatically. ChunkSize must be
	// at least 8KB.
	//
	// If ChunkLength and StreamLength are both specified, the stream will be
	// broken up into ChunkLength chunks. The encoded length of the aws-chunked
	// encoding can still be determined as long as all trailers, if any, have a
	// fixed length.
	ChunkLength int
}

type awsChunkedTrailerValue struct {
	// Function to retrieve the value of the trailer. Will only be called after
	// the underlying stream returns EOF error.
	Get func() (string, error)

	// If the length of the value can be pre-determined, and is constant
	// specify the length. A value of -1 means the length is unknown, or
	// cannot be pre-determined.
	Length int
}

// awsChunkedEncoding provides a reader that wraps the payload such that
// payload is read as a single aws-chunk payload. This reader can only be used
// if the content length of payload is known. Content-Length is used as size of
// the single payload chunk. The final chunk and trailing checksum is appended
// at the end.
//
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-streaming.html#sigv4-chunked-body-definition
//
// Here is the aws-chunked payload stream as read from the awsChunkedEncoding
// if original request stream is "Hello world", and checksum hash used is SHA256
//
//	<b>\r\n
//	Hello world\r\n
//	0\r\n
//	x-amz-checksum-sha256:ZOyIygCyaOW6GjVnihtTFtIS9PNmskdyMlNKiuyjfzw=\r\n
//	\r\n
type awsChunkedEncoding struct {
	options awsChunkedEncodingOptions

	encodedStream        io.Reader
	trailerEncodedLength int
}

// newUnsignedAWSChunkedEncoding returns a new awsChunkedEncoding configured
// for unsigned aws-chunked content encoding. Any additional trailers that need
// to be appended after the end chunk must be included as via Trailer
// callbacks.
func newUnsignedAWSChunkedEncoding(
	stream io.Reader,
	optFns ...func(*awsChunkedEncodingOptions),
) *awsChunkedEncoding {
	options := awsChunkedEncodingOptions{
		Trailers:     map[string]awsChunkedTrailerValue{},
		StreamLength: -1,
		ChunkLength:  -1,
	}
	for _, fn := range optFns {
		fn(&options)
	}

	var chunkReader io.Reader
	if options.ChunkLength != -1 || options.StreamLength == -1 {
		if options.ChunkLength == -1 {
			options.ChunkLength = defaultChunkLength
		}
		chunkReader = newBufferedAWSChunkReader(stream, options.ChunkLength)
	} else {
		chunkReader = newUnsignedChunkReader(stream, options.StreamLength)
	}

	trailerReader := newAWSChunkedTrailerReader(options.Trailers)

	return &awsChunkedEncoding{
		options: options,
		encodedStream: io.MultiReader(chunkReader,
			trailerReader,
			bytes.NewBuffer(crlfBytes),
		),
		trailerEncodedLength: trailerReader.EncodedLength(),
	}
}

// EncodedLength returns the final length of the aws-chunked content encoded
// stream if it can be determined without reading the underlying stream or lazy
// header values, otherwise -1 is returned.
func (e *awsChunkedEncoding) EncodedLength() int64 {
	var length int64
	if e.options.StreamLength == -1 || e.trailerEncodedLength == -1 {
		return -1
	}

	if e.options.StreamLength != 0 {
		// If the stream length is known, and there is no chunk length specified,
		// only a single chunk will be used. Otherwise the stream length needs to
		// include the multiple chunk padding content.
		if e.options.ChunkLength == -1 {
			length += getUnsignedChunkBytesLength(e.options.StreamLength)

		} else {
			// Compute chunk header and payload length
			numChunks := e.options.StreamLength / int64(e.options.ChunkLength)
			length += numChunks * getUnsignedChunkBytesLength(int64(e.options.ChunkLength))
			if remainder := e.options.StreamLength % int64(e.options.ChunkLength); remainder != 0 {
				length += getUnsignedChunkBytesLength(remainder)
			}
		}
	}

	// End chunk
	length += int64(len(finalChunkBytes))

	// Trailers
	length += int64(e.trailerEncodedLength)

	// Encoding terminator
	length += int64(len(crlf))

	return length
}

func getUnsignedChunkBytesLength(payloadLength int64) int64 {
	payloadLengthStr := strconv.FormatInt(payloadLength, 16)
	return int64(len(payloadLengthStr)) + int64(len(crlf)) + payloadLength + int64(len(crlf))
}

// HTTPHeaders returns the set of headers that must be included the request for
// aws-chunked to work. This includes the content-encoding: aws-chunked header.
//
// If there are multiple layered content encoding, the aws-chunked encoding
// must be appended to the previous layers the stream's encoding. The best way
// to do this is to append all header values returned to the HTTP request's set
// of headers.
func (e *awsChunkedEncoding) HTTPHeaders() map[string][]string {
	headers := map[string][]string{
		contentEncodingHeaderName: {
			awsChunkedContentEncodingHeaderValue,
		},
	}

	if len(e.options.Trailers) != 0 {
		trailers := make([]string, 0, len(e.options.Trailers))
		for name := range e.options.Trailers {
			trailers = append(trailers, strings.ToLower(name))
		}
		headers[awsTrailerHeaderName] = trailers
	}

	return headers
}

func (e *awsChunkedEncoding) Read(b []byte) (n int, err error) {
	return e.encodedStream.Read(b)
}

// awsChunkedTrailerReader provides a lazy reader for reading of aws-chunked
// content encoded trailers. The trailer values will not be retrieved until the
// reader is read from.
type awsChunkedTrailerReader struct {
	reader               *bytes.Buffer
	trailers             map[string]awsChunkedTrailerValue
	trailerEncodedLength int
}

// newAWSChunkedTrailerReader returns an initialized awsChunkedTrailerReader to
// lazy reading aws-chunk content encoded trailers.
func newAWSChunkedTrailerReader(trailers map[string]awsChunkedTrailerValue) *awsChunkedTrailerReader {
	return &awsChunkedTrailerReader{
		trailers:             trailers,
		trailerEncodedLength: trailerEncodedLength(trailers),
	}
}

func trailerEncodedLength(trailers map[string]awsChunkedTrailerValue) (length int) {
	for name, trailer := range trailers {
		length += len(name) + len(trailerKeyValueSeparator)
		l := trailer.Length
		if l == -1 {
			return -1
		}
		length += l + len(crlf)
	}

	return length
}

// EncodedLength returns the length of the encoded trailers if the length could
// be determined without retrieving the header values. Returns -1 if length is
// unknown.
func (r *awsChunkedTrailerReader) EncodedLength() (length int) {
	return r.trailerEncodedLength
}

// Read populates the passed in byte slice with bytes from the encoded
// trailers. Will lazy read header values first time Read is called.
func (r *awsChunkedTrailerReader) Read(p []byte) (int, error) {
	if r.trailerEncodedLength == 0 {
		return 0, io.EOF
	}

	if r.reader == nil {
		trailerLen := r.trailerEncodedLength
		if r.trailerEncodedLength == -1 {
			trailerLen = 0
		}
		r.reader = bytes.NewBuffer(make([]byte, 0, trailerLen))
		for name, trailer := range r.trailers {
			r.reader.WriteString(name)
			r.reader.WriteString(trailerKeyValueSeparator)
			v, err := trailer.Get()
			if err != nil {
				return 0, fmt.Errorf("failed to get trailer value, %w", err)
			}
			r.reader.WriteString(v)
			r.reader.WriteString(crlf)
		}
	}

	return r.reader.Read(p)
}

// newUnsignedChunkReader returns an io.Reader encoding the underlying reader
// as unsigned aws-chunked chunks. The returned reader will also include the
// end chunk, but not the aws-chunked final `crlf` segment so trailers can be
// added.
//
// If the payload size is -1 for unknown length the content will be buffered in
// defaultChunkLength chunks before wrapped in aws-chunked chunk encoding.
func newUnsignedChunkReader(reader io.Reader, payloadSize int64) io.Reader {
	if payloadSize == -1 {
		return newBufferedAWSChunkReader(reader, defaultChunkLength)
	}

	var endChunk bytes.Buffer
	if payloadSize == 0 {
		endChunk.Write(finalChunkBytes)
		return &endChunk
	}

	endChunk.WriteString(crlf)
	endChunk.Write(finalChunkBytes)

	var header bytes.Buffer
	header.WriteString(strconv.FormatInt(payloadSize, 16))
	header.WriteString(crlf)
	return io.MultiReader(
		&header,
		reader,
		&endChunk,
	)
}

// Provides a buffered aws-chunked chunk encoder of an underlying io.Reader.
// Will include end chunk, but not the aws-chunked final `crlf` segment so
// trailers can be added.
//
// Note does not implement support for chunk extensions, e.g. chunk signing.
type bufferedAWSChunkReader struct {
	reader       io.Reader
	chunkSize    int
	chunkSizeStr string

	headerBuffer *bytes.Buffer
	chunkBuffer  *bytes.Buffer

	multiReader    io.Reader
	multiReaderLen int
	endChunkDone   bool
}

// newBufferedAWSChunkReader returns an bufferedAWSChunkReader for reading
// aws-chunked encoded chunks.
func newBufferedAWSChunkReader(reader io.Reader, chunkSize int) *bufferedAWSChunkReader {
	return &bufferedAWSChunkReader{
		reader:       reader,
		chunkSize:    chunkSize,
		chunkSizeStr: strconv.FormatInt(int64(chunkSize), 16),

		headerBuffer: bytes.NewBuffer(make([]byte, 0, 64)),
		chunkBuffer:  bytes.NewBuffer(make([]byte, 0, chunkSize+len(crlf))),
	}
}

// Read attempts to read from the underlying io.Reader writing aws-chunked
// chunk encoded bytes to p. When the underlying io.Reader has been completed
// read the end chunk will be available. Once the end chunk is read, the reader
// will return EOF.
func (r *bufferedAWSChunkReader) Read(p []byte) (n int, err error) {
	if r.multiReaderLen == 0 && r.endChunkDone {
		return 0, io.EOF
	}
	if r.multiReader == nil || r.multiReaderLen == 0 {
		r.multiReader, r.multiReaderLen, err = r.newMultiReader()
		if err != nil {
			return 0, err
		}
	}

	n, err = r.multiReader.Read(p)
	r.multiReaderLen -= n

	if err == io.EOF && !r.endChunkDone {
		// Edge case handling when the multi-reader has been completely read,
		// and returned an EOF, make sure that EOF only gets returned if the
		// end chunk was included in the multi-reader. Otherwise, the next call
		// to read will initialize the next chunk's multi-reader.
		err = nil
	}
	return n, err
}

// newMultiReader returns a new io.Reader for wrapping the next chunk. Will
// return an error if the underlying reader can not be read from. Will never
// return io.EOF.
func (r *bufferedAWSChunkReader) newMultiReader() (io.Reader, int, error) {
	// io.Copy eats the io.EOF returned by io.LimitReader. Any error that
	// occurs here is due to an actual read error.
	n, err := io.Copy(r.chunkBuffer, io.LimitReader(r.reader, int64(r.chunkSize)))
	if err != nil {
		return nil, 0, err
	}
	if n == 0 {
		// Early exit writing out only the end chunk. This does not include
		// aws-chunk's final `crlf` so that trailers can still be added by
		// upstream reader.
		r.headerBuffer.Reset()
		r.headerBuffer.WriteString("0")
		r.headerBuffer.WriteString(crlf)
		r.endChunkDone = true

		return r.headerBuffer, r.headerBuffer.Len(), nil
	}
	r.chunkBuffer.WriteString(crlf)

	chunkSizeStr := r.chunkSizeStr
	if int(n) != r.chunkSize {
		chunkSizeStr = strconv.FormatInt(n, 16)
	}

	r.headerBuffer.Reset()
	r.headerBuffer.WriteString(chunkSizeStr)
	r.headerBuffer.WriteString(crlf)

	return io.MultiReader(
		r.headerBuffer,
		r.chunkBuffer,
	), r.headerBuffer.Len() + r.chunkBuffer.Len(), nil
}
