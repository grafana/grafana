package protocol

import (
	"context"
	"fmt"
	"io"
	"strconv"

	"github.com/grafana/nanogit/log"
)

// ParseLsRefsResponse parses the ls-refs response one packet at a time.
func ParseLsRefsResponse(ctx context.Context, reader io.Reader) ([]RefLine, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Starting ls-refs response parsing")
	refs := make([]RefLine, 0)
	count := 0

	for {
		count++
		logger.Debug("Reading packet", "packet_number", count)
		// Read packet length (4 hex bytes)
		lengthBytes := make([]byte, 4)
		_, err := io.ReadFull(reader, lengthBytes)
		if err != nil {
			if err == io.EOF {
				// End of stream
				logger.Debug("Reached end of stream", "total_packets", count-1, "total_refs", len(refs))
				return refs, nil
			}

			logger.Debug("Error reading packet length", "error", err, "packet_number", count)
			return nil, fmt.Errorf("reading packet length: %w", err)
		}

		logger.Debug("Read packet length bytes", "length_bytes", string(lengthBytes), "packet_number", count)

		length, err := strconv.ParseUint(string(lengthBytes), 16, 16)
		if err != nil {
			logger.Debug("Error parsing packet length", "error", err, "length_bytes", string(lengthBytes), "packet_number", count)
			return nil, fmt.Errorf("parsing packet length: %w", err)
		}

		logger.Debug("Parsed packet length", "length", length, "packet_number", count)

		// Handle different packet types
		switch {
		case length < 4:
			// Special packets (flush, delimiter, response-end)
			logger.Debug("Received special packet", "length", length, "packet_number", count)
			if length == 0 {
				// Flush packet (0000) - end of response
				logger.Debug("Flush packet received, ending response", "total_packets", count, "total_refs", len(refs))
				return refs, nil
			}
			// Other special packets - continue reading
			logger.Debug("Continuing after special packet", "length", length)
			continue

		case length == 4:
			// Empty packet - continue
			logger.Debug("Empty packet received, continuing", "packet_number", count)
			continue
		default:
			// Read packet data
			dataLength := length - 4
			packetData := make([]byte, dataLength)
			if _, err := io.ReadFull(reader, packetData); err != nil {
				if err == io.ErrUnexpectedEOF {
					return nil, fmt.Errorf("line declared %d bytes but unexpected EOF occurred", dataLength)
				}

				return nil, fmt.Errorf("reading packet data: %w", err)
			}

			logger.Debug("Parsing ls-refs packet",
				"packet_data", string(packetData),
				"data_length", dataLength)

			// Parse this packet as a ref line
			refLine, err := ParseRefLine(packetData)
			if err != nil {
				return nil, fmt.Errorf("parse ref line: %w", err)
			}

			// Only add non-empty ref names
			if refLine.RefName != "" {
				refs = append(refs, refLine)
			}
		}
	}
}
