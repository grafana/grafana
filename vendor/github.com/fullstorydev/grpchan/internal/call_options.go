package internal

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
)

// CallOptions represents the state of in-effect grpc.CallOptions.
type CallOptions struct {
	// Headers is a slice of metadata pointers which should all be set when
	// response header metadata is received.
	Headers []*metadata.MD
	// Trailers is a slice of metadata pointers which should all be set when
	// response trailer metadata is received.
	Trailers []*metadata.MD
	// Peer is a slice of peer pointers which should all be set when the
	// remote peer is known.
	Peer []*peer.Peer
	// Creds are per-RPC credentials to use for a call.
	Creds credentials.PerRPCCredentials
	// MaxRecv is the maximum number of bytes to receive for a single message
	// in a call.
	MaxRecv int
	// MaxSend is the maximum number of bytes to send for a single message in
	// a call.
	MaxSend int
}

// SetHeaders sets all accumulated header addresses to the given metadata. This
// satisfies grpc.Header call options.
func (co *CallOptions) SetHeaders(md metadata.MD) {
	for _, hdr := range co.Headers {
		*hdr = md
	}
}

// SetTrailers sets all accumulated trailer addresses to the given metadata.
// This satisfies grpc.Trailer call options.
func (co *CallOptions) SetTrailers(md metadata.MD) {
	for _, tlr := range co.Trailers {
		*tlr = md
	}
}

// SetPeer sets all accumulated peer addresses to the given peer. This satisfies
// grpc.Peer call options.
func (co *CallOptions) SetPeer(p *peer.Peer) {
	for _, pr := range co.Peer {
		*pr = *p
	}
}

// GetCallOptions converts the given slice of grpc.CallOptions into a
// CallOptions struct.
func GetCallOptions(opts []grpc.CallOption) *CallOptions {
	var copts CallOptions
	for _, o := range opts {
		switch o := o.(type) {
		case grpc.HeaderCallOption:
			copts.Headers = append(copts.Headers, o.HeaderAddr)
		case grpc.TrailerCallOption:
			copts.Trailers = append(copts.Trailers, o.TrailerAddr)
		case grpc.PeerCallOption:
			copts.Peer = append(copts.Peer, o.PeerAddr)
		case grpc.PerRPCCredsCallOption:
			copts.Creds = o.Creds
		case grpc.MaxRecvMsgSizeCallOption:
			copts.MaxRecv = o.MaxRecvMsgSize
		case grpc.MaxSendMsgSizeCallOption:
			copts.MaxSend = o.MaxSendMsgSize
		}
	}
	return &copts
}

// ApplyPerRPCCreds applies any per-RPC credentials in the given call options and
// returns a new context with the additional metadata. It will return an error if
// isChannelSecure is false but the per-RPC credentials require a secure channel.
func ApplyPerRPCCreds(ctx context.Context, copts *CallOptions, uri string, isChannelSecure bool) (context.Context, error) {
	if copts.Creds != nil {
		if copts.Creds.RequireTransportSecurity() && !isChannelSecure {
			return nil, fmt.Errorf("transport security is required")
		}
		md, err := copts.Creds.GetRequestMetadata(ctx, uri)
		if err != nil {
			return nil, err
		}
		if len(md) > 0 {
			reqHeaders, ok := metadata.FromOutgoingContext(ctx)
			if ok {
				reqHeaders = metadata.Join(reqHeaders, metadata.New(md))
			} else {
				reqHeaders = metadata.New(md)
			}
			ctx = metadata.NewOutgoingContext(ctx, reqHeaders)
		}
	}
	return ctx, nil
}
