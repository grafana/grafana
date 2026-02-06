package protocol

import (
	"context"
	"errors"
	"io"
	"strings"

	"github.com/grafana/nanogit/log"
)

// Acknowledgements contains whether a nack ("NAK") was received, or a list of ACKs, and for which objects those apply.
// If Nack is true, Acks is always empty. If Nack is false, Acks may be non-empty.
// The objects returned in Acks are always requested. Not all requested objects are necessarily listed.
// Not all sent objects are included in the list, and it may even be empty even if a cut point is found. This is an optimisation by the Git server.
//
// [Git documentation][protocol_fetch] defines the format as:
//
//	acknowledgments = PKT-LINE("acknowledgments" LF)
//	    (nak | *ack)
//	    (ready)
//	ready = PKT-LINE("ready" LF)
//	nak = PKT-LINE("NAK" LF)
//	ack = PKT-LINE("ACK" SP obj-id LF)
//
// [protocol_fetch]: https://git-scm.com/docs/protocol-v2#_fetch
type Acknowledgements struct {
	// Invariant: Nack == true => Acks == nil
	//            Nack == false => len(Acks) >= 0

	Nack bool
	// FIXME: Are obj-ids fine as strings? Do we want a more proper type for them?
	//    obj-id    =  40*(HEXDIGIT)
	Acks []string
}

// TODO: Do we want to parse the acknowledgements here?

type FetchResponse struct {
	// These fields are in order.
	// TODO: Do we want a session ID field? It might be useful for OTel tracing?

	Acks Acknowledgements
	// mariell: Intentionally excluding shallow-info because we don't need them right now. Maybe later?
	// mariell: Intentionally excluding wanted-refs because we don't need them right now. Maybe later?
	// mariell: Intentionally excluding packfile-uris because I can't see us needing them.

	// The packfile contains the majority of the information we want.
	//
	//	packfile section
	//	* This section is only included if the client has sent 'want'
	//	  lines in its request and either requested that no more
	//	  negotiation be done by sending 'done' or if the server has
	//	  decided it has found a sufficient cut point to produce a
	//	  packfile.
	//
	//	Always begins with the section header "packfile".
	//
	//	The transmission of the packfile begins immediately after the section header.
	//
	//	The data transfer of the packfile is always multiplexed, using the same semantics of the side-band-64k capability from protocol version 1.
	//	This means that each packet, during the packfile data stream, is made up of a leading 4-byte pkt-line length (typical of the pkt-line format), followed by a 1-byte stream code, followed by the actual data.
	//
	//	The stream code can be one of:
	//	1 - pack data
	//	2 - progress messages
	//	3 - fatal error message just before stream aborts
	Packfile *PackfileReader
	// When encoded, a flush-pkt is presented here.
}

type FatalFetchError string

func (e FatalFetchError) Error() string {
	return string(e)
}

var (
	ErrInvalidFetchStatus       = errors.New("invalid status in fetch packfile")
	_                     error = FatalFetchError("")
)

// MultiplexedReader wraps a Parser to handle Git protocol multiplexing.
// It processes status bytes in the multiplexed stream:
// - Status 1: Pack data (returned via Read)
// - Status 2: Progress messages (logged and skipped)
// - Status 3: Fatal error messages (returned as error)
type MultiplexedReader struct {
	parser *Parser
	logger log.Logger
	buffer []byte // Buffer for incomplete data
	eof    bool
	err    error
}

// NewMultiplexedReader creates a new MultiplexedReader that handles Git protocol multiplexing.
func NewMultiplexedReader(ctx context.Context, parser *Parser) *MultiplexedReader {
	return &MultiplexedReader{
		parser: parser,
		logger: log.FromContext(ctx),
		buffer: make([]byte, 0),
	}
}

// Read implements io.Reader interface.
// It reads from the multiplexed stream, handling status bytes and returning only pack data.
func (mr *MultiplexedReader) Read(p []byte) (n int, err error) {
	if mr.err != nil {
		return 0, mr.err
	}

	if mr.eof && len(mr.buffer) == 0 {
		return 0, io.EOF
	}

	// If we have buffered data, serve it first
	if len(mr.buffer) > 0 {
		n = copy(p, mr.buffer)
		mr.buffer = mr.buffer[n:]
		mr.logger.Debug("Served buffered data", "bytes_served", n, "remaining_buffer", len(mr.buffer))
		return n, nil
	}

	// Read more data from the parser
	for {
		if mr.eof {
			return 0, io.EOF
		}

		packet, err := mr.parser.Next()
		if err != nil {
			if err == io.EOF {
				mr.logger.Debug("Reached end of multiplexed stream")
				mr.eof = true
				return 0, io.EOF
			}
			mr.logger.Debug("Error reading packet from parser", "error", err)
			mr.err = err
			return 0, err
		}

		if len(packet) == 0 {
			mr.logger.Debug("Received empty packet, continuing")
			continue
		}

		status := packet[0]
		mr.logger.Debug("Processing multiplexed packet", "status", status, "packet_size", len(packet))

		switch status {
		case 1: // Pack data
			data := packet[1:]
			if len(data) == 0 {
				mr.logger.Debug("Received empty pack data packet, continuing")
				continue
			}

			// Copy what fits into the provided buffer
			n = copy(p, data)

			// If there's remaining data, buffer it
			if n < len(data) {
				mr.buffer = append(mr.buffer, data[n:]...)
				mr.logger.Debug("Added pack data", "bytes_returned", n, "bytes_buffered", len(data)-n)
			} else {
				mr.logger.Debug("Added pack data", "bytes_returned", n)
			}

			return n, nil

		case 2: // Progress message
			message := string(packet[1:])
			mr.logger.Debug("Received progress message", "message", message)
			// Continue to next packet

		case 3: // Fatal error
			errorMsg := string(packet[1:])
			mr.logger.Debug("Received fatal error message", "error_message", errorMsg)
			mr.err = FatalFetchError(errorMsg)
			return 0, mr.err

		default:
			mr.logger.Debug("Invalid status in multiplexed stream", "status", status)
			mr.err = ErrInvalidFetchStatus
			return 0, mr.err
		}
	}
}

func ParseFetchResponse(ctx context.Context, parser *Parser) (response *FetchResponse, err error) {
	logger := log.FromContext(ctx)
	logger.Debug("Starting fetch response parsing")

	fr := &FetchResponse{}
	sectionCount := 0

outer:
	for {
		sectionCount++
		logger.Debug("Reading next section", "section_number", sectionCount)

		line, err := parser.Next()
		if err != nil {
			if err == io.EOF {
				logger.Debug("Reached end of response", "total_sections", sectionCount-1)
				break
			}

			logger.Debug("Error reading next line", "error", err, "section_number", sectionCount)
			return nil, err
		}

		logger.Debug("Received line", "line_content", strings.TrimSpace(string(line)), "line_length", len(line), "section_number", sectionCount)

		if len(line) > 30 {
			// Too long to be a section header
			logger.Debug("Line too long to be section header, skipping", "line_length", len(line))
			continue
		}

		// We SHOULD NOT require a \n.
		sectionType := strings.TrimSpace(string(line))
		logger.Debug("Processing section", "section_type", sectionType, "section_number", sectionCount)

		switch sectionType {
		case "acknowledgements":
			logger.Debug("Processing acknowledgements section")
			// TODO: Parse!
		case "packfile":
			logger.Debug("Processing packfile section")

			// Create a multiplexed reader to handle the Git protocol multiplexing
			multiplexedReader := NewMultiplexedReader(ctx, parser)
			var err error
			fr.Packfile, err = ParsePackfile(ctx, multiplexedReader)
			if err != nil {
				logger.Debug("Error parsing packfile", "error", err)
				return nil, err
			}

			if fr.Packfile == nil {
				logger.Debug("No packfile data collected, returning empty response")
				return fr, nil
			}

			logger.Debug("Successfully parsed packfile")
			break outer // break out of the outer loop since we've processed the packfile
		case "shallow-info", "wanted-refs":
			logger.Debug("Ignoring section", "section_type", sectionType)
			// Ignore.
		default:
			logger.Debug("Unknown section type encountered", "section_type", sectionType, "section_number", sectionCount)
			// TODO: what do we do here? log?
		}
	}

	logger.Debug("Completed fetch response parsing", "total_sections_processed", sectionCount)

	return fr, nil
}
