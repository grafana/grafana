package internal

import (
	"fmt"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// UnaryServerTransportStream implements grpc.ServerTransportStream and can be
// used by unary calls to collect headers and trailers from a handler.
type UnaryServerTransportStream struct {
	// Name is the full method name in "/service/method" format.
	Name string

	mu       sync.Mutex
	hdrs     metadata.MD
	hdrsSent bool
	tlrs     metadata.MD
	tlrsSent bool
}

// Method satisfies the grpc.ServerTransportStream, returning the full path of
// the method invocation that the stream represents.
func (sts *UnaryServerTransportStream) Method() string {
	return sts.Name
}

// Finish marks headers and trailers as sent, so that subsequent calls to
// SetHeader, SendHeader, or SetTrailer will fail.
func (sts *UnaryServerTransportStream) Finish() {
	sts.mu.Lock()
	defer sts.mu.Unlock()
	sts.hdrsSent = true
	sts.tlrsSent = true
}

// SetHeader satisfies the grpc.ServerTransportStream, adding the given metadata
// to the set of response headers that will be sent to the client.
func (sts *UnaryServerTransportStream) SetHeader(md metadata.MD) error {
	sts.mu.Lock()
	defer sts.mu.Unlock()
	return sts.setHeaderLocked(md)
}

// SendHeader satisfies the grpc.ServerTransportStream, adding the given
// metadata to the set of response headers. This implementation does not
// actually send the headers but rather marks the headers as sent so that future
// calls to SetHeader or SendHeader will return an error.
func (sts *UnaryServerTransportStream) SendHeader(md metadata.MD) error {
	sts.mu.Lock()
	defer sts.mu.Unlock()
	if err := sts.setHeaderLocked(md); err != nil {
		return err
	}
	sts.hdrsSent = true
	return nil
}

func (sts *UnaryServerTransportStream) setHeaderLocked(md metadata.MD) error {
	if sts.hdrsSent {
		return fmt.Errorf("headers already sent")
	}
	if sts.hdrs == nil {
		sts.hdrs = metadata.MD{}
	}
	for k, v := range md {
		sts.hdrs[k] = append(sts.hdrs[k], v...)
	}
	return nil
}

// GetHeaders returns the cumulative set of headers set by calls to SetHeader
// and SendHeader. This is used by a server to gather the headers that must
// actually be sent to a client.
func (sts *UnaryServerTransportStream) GetHeaders() metadata.MD {
	sts.mu.Lock()
	defer sts.mu.Unlock()
	return sts.hdrs
}

// SetTrailer satisfies the grpc.ServerTransportStream, adding the given
// metadata to the set of response trailers that will be sent to the client.
func (sts *UnaryServerTransportStream) SetTrailer(md metadata.MD) error {
	sts.mu.Lock()
	defer sts.mu.Unlock()
	if sts.tlrsSent {
		return fmt.Errorf("trailers already sent")
	}
	if sts.tlrs == nil {
		sts.tlrs = metadata.MD{}
	}
	for k, v := range md {
		sts.tlrs[k] = append(sts.tlrs[k], v...)
	}
	return nil
}

// GetTrailers returns the cumulative set of trailers set by calls to
// SetTrailer. This is used by a server to gather the headers that must actually
// be sent to a client.
func (sts *UnaryServerTransportStream) GetTrailers() metadata.MD {
	sts.mu.Lock()
	defer sts.mu.Unlock()
	return sts.tlrs
}

// ServerTransportStream implements grpc.ServerTransportStream and wraps a
// grpc.ServerStream, delegating most calls to it.
type ServerTransportStream struct {
	// Name is the full method name in "/service/method" format.
	Name string
	// Stream is the underlying stream to which header and trailer calls are
	// delegated.
	Stream grpc.ServerStream
}

// Method satisfies the grpc.ServerTransportStream, returning the full path of
// the method invocation that the stream represents.
func (sts *ServerTransportStream) Method() string {
	return sts.Name
}

// SetHeader satisfies the grpc.ServerTransportStream and delegates to the
// underlying grpc.ServerStream.
func (sts *ServerTransportStream) SetHeader(md metadata.MD) error {
	return sts.Stream.SetHeader(md)
}

// SendHeader satisfies the grpc.ServerTransportStream and delegates to the
// underlying grpc.ServerStream.
func (sts *ServerTransportStream) SendHeader(md metadata.MD) error {
	return sts.Stream.SendHeader(md)
}

// SetTrailer satisfies the grpc.ServerTransportStream and delegates to the
// underlying grpc.ServerStream. If the underlying stream provides a
// TrySetTrailer(metadata.MD) error method, it will be used to set trailers.
// Otherwise, the normal SetTrailer(metadata.MD) method will be used and a nil
// error will always be returned.
func (sts *ServerTransportStream) SetTrailer(md metadata.MD) error {
	type trailerWithErrors interface {
		TrySetTrailer(md metadata.MD) error
	}
	if t, ok := sts.Stream.(trailerWithErrors); ok {
		return t.TrySetTrailer(md)
	}
	sts.Stream.SetTrailer(md)
	return nil
}
