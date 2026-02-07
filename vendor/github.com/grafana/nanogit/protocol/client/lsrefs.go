package client

import (
	"bytes"
	"context"
	"fmt"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol"
)

type LsRefsOptions struct {
	Prefix string
}

func (c *rawClient) LsRefs(ctx context.Context, opts LsRefsOptions) ([]protocol.RefLine, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Ls-refs", "prefix", opts.Prefix)

	// Send the ls-refs command directly - Protocol v2 allows this without needing
	// a separate capability advertisement request
	packs := []protocol.Pack{
		protocol.PackLine("command=ls-refs\n"),
		protocol.PackLine("object-format=sha1\n"),
	}

	if opts.Prefix != "" {
		packs = append(packs, protocol.DelimeterPacket)
		packs = append(packs, protocol.PackLine(fmt.Sprintf("ref-prefix %s\n", opts.Prefix)))
	}

	packs = append(packs, protocol.FlushPacket)
	pkt, err := protocol.FormatPacks(packs...)
	if err != nil {
		return nil, fmt.Errorf("format ls-refs command: %w", err)
	}

	logger.Debug("Send Ls-refs request", "requestSize", len(pkt))
	logger.Debug("Ls-refs raw request", "request", string(pkt))

	refsReader, err := c.UploadPack(ctx, bytes.NewReader(pkt))
	if err != nil {
		return nil, fmt.Errorf("send ls-refs command: %w", err)
	}

	defer func() {
		if closeErr := refsReader.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("error closing refs reader: %w", closeErr)
		}
	}()

	logger.Debug("Parsing ls-refs response")
	refs, err := protocol.ParseLsRefsResponse(ctx, refsReader)
	if err != nil {
		return nil, fmt.Errorf("parse refs response: %w", err)
	}

	logger.Debug("Ls-refs completed", "refCount", len(refs))
	return refs, nil
}
