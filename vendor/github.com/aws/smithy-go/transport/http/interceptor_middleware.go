package http

import (
	"context"
	"errors"

	"github.com/aws/smithy-go/middleware"
)

type ictxKey struct{}

func withIctx(ctx context.Context) context.Context {
	return middleware.WithStackValue(ctx, ictxKey{}, &InterceptorContext{})
}

func getIctx(ctx context.Context) *InterceptorContext {
	return middleware.GetStackValue(ctx, ictxKey{}).(*InterceptorContext)
}

// InterceptExecution runs Before/AfterExecutionInterceptors.
type InterceptExecution struct {
	BeforeExecution []BeforeExecutionInterceptor
	AfterExecution  []AfterExecutionInterceptor
}

// ID identifies the middleware.
func (m *InterceptExecution) ID() string {
	return "InterceptExecution"
}

// HandleInitialize runs the interceptors.
func (m *InterceptExecution) HandleInitialize(
	ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler,
) (
	out middleware.InitializeOutput, md middleware.Metadata, err error,
) {
	ctx = withIctx(ctx)
	getIctx(ctx).Input = in.Parameters

	for _, i := range m.BeforeExecution {
		if err := i.BeforeExecution(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	out, md, err = next.HandleInitialize(ctx, in)

	for _, i := range m.AfterExecution {
		if err := i.AfterExecution(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return out, md, err
}

// InterceptBeforeSerialization runs BeforeSerializationInterceptors.
type InterceptBeforeSerialization struct {
	Interceptors []BeforeSerializationInterceptor
}

// ID identifies the middleware.
func (m *InterceptBeforeSerialization) ID() string {
	return "InterceptBeforeSerialization"
}

// HandleSerialize runs the interceptors.
func (m *InterceptBeforeSerialization) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, md middleware.Metadata, err error,
) {
	for _, i := range m.Interceptors {
		if err := i.BeforeSerialization(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return next.HandleSerialize(ctx, in)
}

// InterceptAfterSerialization runs AfterSerializationInterceptors.
type InterceptAfterSerialization struct {
	Interceptors []AfterSerializationInterceptor
}

// ID identifies the middleware.
func (m *InterceptAfterSerialization) ID() string {
	return "InterceptAfterSerialization"
}

// HandleSerialize runs the interceptors.
func (m *InterceptAfterSerialization) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, md middleware.Metadata, err error,
) {
	getIctx(ctx).Request = in.Request.(*Request)

	for _, i := range m.Interceptors {
		if err := i.AfterSerialization(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return next.HandleSerialize(ctx, in)
}

// InterceptBeforeRetryLoop runs BeforeRetryLoopInterceptors.
type InterceptBeforeRetryLoop struct {
	Interceptors []BeforeRetryLoopInterceptor
}

// ID identifies the middleware.
func (m *InterceptBeforeRetryLoop) ID() string {
	return "InterceptBeforeRetryLoop"
}

// HandleFinalize runs the interceptors.
func (m *InterceptBeforeRetryLoop) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, md middleware.Metadata, err error,
) {
	for _, i := range m.Interceptors {
		if err := i.BeforeRetryLoop(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return next.HandleFinalize(ctx, in)
}

// InterceptBeforeSigning runs BeforeSigningInterceptors.
type InterceptBeforeSigning struct {
	Interceptors []BeforeSigningInterceptor
}

// ID identifies the middleware.
func (m *InterceptBeforeSigning) ID() string {
	return "InterceptBeforeSigning"
}

// HandleFinalize runs the interceptors.
func (m *InterceptBeforeSigning) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, md middleware.Metadata, err error,
) {
	for _, i := range m.Interceptors {
		if err := i.BeforeSigning(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return next.HandleFinalize(ctx, in)
}

// InterceptAfterSigning runs AfterSigningInterceptors.
type InterceptAfterSigning struct {
	Interceptors []AfterSigningInterceptor
}

// ID identifies the middleware.
func (m *InterceptAfterSigning) ID() string {
	return "InterceptAfterSigning"
}

// HandleFinalize runs the interceptors.
func (m *InterceptAfterSigning) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, md middleware.Metadata, err error,
) {
	for _, i := range m.Interceptors {
		if err := i.AfterSigning(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return next.HandleFinalize(ctx, in)
}

// InterceptTransmit runs BeforeTransmitInterceptors and AfterTransmitInterceptors.
type InterceptTransmit struct {
	BeforeTransmit []BeforeTransmitInterceptor
	AfterTransmit  []AfterTransmitInterceptor
}

// ID identifies the middleware.
func (m *InterceptTransmit) ID() string {
	return "InterceptTransmit"
}

// HandleDeserialize runs the interceptors.
func (m *InterceptTransmit) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, md middleware.Metadata, err error,
) {
	for _, i := range m.BeforeTransmit {
		if err := i.BeforeTransmit(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	out, md, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, md, err
	}

	// the root of the decorated middleware guarantees this will be here
	// (client.go: ClientHandler.Handle)
	getIctx(ctx).Response = out.RawResponse.(*Response)

	for _, i := range m.AfterTransmit {
		if err := i.AfterTransmit(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return out, md, err
}

// InterceptBeforeDeserialization runs BeforeDeserializationInterceptors.
type InterceptBeforeDeserialization struct {
	Interceptors []BeforeDeserializationInterceptor
}

// ID identifies the middleware.
func (m *InterceptBeforeDeserialization) ID() string {
	return "InterceptBeforeDeserialization"
}

// HandleDeserialize runs the interceptors.
func (m *InterceptBeforeDeserialization) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, md middleware.Metadata, err error,
) {
	out, md, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		var terr *RequestSendError
		if errors.As(err, &terr) {
			return out, md, err
		}
	}

	for _, i := range m.Interceptors {
		if err := i.BeforeDeserialization(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return out, md, err
}

// InterceptAfterDeserialization runs AfterDeserializationInterceptors.
type InterceptAfterDeserialization struct {
	Interceptors []AfterDeserializationInterceptor
}

// ID identifies the middleware.
func (m *InterceptAfterDeserialization) ID() string {
	return "InterceptAfterDeserialization"
}

// HandleDeserialize runs the interceptors.
func (m *InterceptAfterDeserialization) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, md middleware.Metadata, err error,
) {
	out, md, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		var terr *RequestSendError
		if errors.As(err, &terr) {
			return out, md, err
		}
	}

	getIctx(ctx).Output = out.Result

	for _, i := range m.Interceptors {
		if err := i.AfterDeserialization(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return out, md, err
}

// InterceptAttempt runs AfterAttemptInterceptors.
type InterceptAttempt struct {
	BeforeAttempt []BeforeAttemptInterceptor
	AfterAttempt  []AfterAttemptInterceptor
}

// ID identifies the middleware.
func (m *InterceptAttempt) ID() string {
	return "InterceptAttempt"
}

// HandleFinalize runs the interceptors.
func (m *InterceptAttempt) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, md middleware.Metadata, err error,
) {
	for _, i := range m.BeforeAttempt {
		if err := i.BeforeAttempt(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	out, md, err = next.HandleFinalize(ctx, in)

	for _, i := range m.AfterAttempt {
		if err := i.AfterAttempt(ctx, getIctx(ctx)); err != nil {
			return out, md, err
		}
	}

	return out, md, err
}
