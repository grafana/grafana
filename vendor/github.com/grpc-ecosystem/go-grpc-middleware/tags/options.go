// Copyright 2017 Michal Witkowski. All Rights Reserved.
// See LICENSE for licensing terms.

package grpc_ctxtags

var (
	defaultOptions = &options{
		requestFieldsFunc: nil,
	}
)

type options struct {
	requestFieldsFunc        RequestFieldExtractorFunc
	requestFieldsFromInitial bool
}

func evaluateOptions(opts []Option) *options {
	optCopy := &options{}
	*optCopy = *defaultOptions
	for _, o := range opts {
		o(optCopy)
	}
	return optCopy
}

type Option func(*options)

// WithFieldExtractor customizes the function for extracting log fields from protobuf messages, for
// unary and server-streamed methods only.
func WithFieldExtractor(f RequestFieldExtractorFunc) Option {
	return func(o *options) {
		o.requestFieldsFunc = f
	}
}

// WithFieldExtractorForInitialReq customizes the function for extracting log fields from protobuf messages,
// for all unary and streaming methods. For client-streams and bidirectional-streams, the tags will be
// extracted from the first message from the client.
func WithFieldExtractorForInitialReq(f RequestFieldExtractorFunc) Option {
	return func(o *options) {
		o.requestFieldsFunc = f
		o.requestFieldsFromInitial = true
	}
}
