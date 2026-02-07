package http

import (
	"context"
	"fmt"

	"github.com/aws/smithy-go/middleware"
)

const contentMD5Header = "Content-Md5"

// contentMD5Checksum provides a middleware to compute and set
// content-md5 checksum for a http request
type contentMD5Checksum struct {
}

// AddContentChecksumMiddleware adds checksum middleware to middleware's
// build step.
func AddContentChecksumMiddleware(stack *middleware.Stack) error {
	// This middleware must be executed before request body is set.
	return stack.Build.Add(&contentMD5Checksum{}, middleware.Before)
}

// ID returns the identifier for the checksum middleware
func (m *contentMD5Checksum) ID() string { return "ContentChecksum" }

// HandleBuild adds behavior to compute md5 checksum and add content-md5 header
// on http request
func (m *contentMD5Checksum) HandleBuild(
	ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler,
) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	req, ok := in.Request.(*Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	// if Content-MD5 header is already present, return
	if v := req.Header.Get(contentMD5Header); len(v) != 0 {
		return next.HandleBuild(ctx, in)
	}

	// fetch the request stream.
	stream := req.GetStream()
	// compute checksum if payload is explicit
	if stream != nil {
		if !req.IsStreamSeekable() {
			return out, metadata, fmt.Errorf(
				"unseekable stream is not supported for computing md5 checksum")
		}

		v, err := computeMD5Checksum(stream)
		if err != nil {
			return out, metadata, fmt.Errorf("error computing md5 checksum, %w", err)
		}

		// reset the request stream
		if err := req.RewindStream(); err != nil {
			return out, metadata, fmt.Errorf(
				"error rewinding request stream after computing md5 checksum, %w", err)
		}

		// set the 'Content-MD5' header
		req.Header.Set(contentMD5Header, string(v))
	}

	// set md5 header value
	return next.HandleBuild(ctx, in)
}
