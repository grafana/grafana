// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

package logging

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/peer"
	"google.golang.org/protobuf/proto"
)

type reporter struct {
	interceptors.CallMeta

	ctx             context.Context
	kind            string
	startCallLogged bool

	opts   *options
	fields Fields
	logger Logger
}

func (c *reporter) PostCall(err error, duration time.Duration) {
	if !has(c.opts.loggableEvents, FinishCall) {
		return
	}
	if errors.Is(err, io.EOF) {
		err = nil
	}

	code := c.opts.codeFunc(err)
	fields := c.fields.WithUnique(ExtractFields(c.ctx))
	fields = fields.AppendUnique(Fields{"grpc.code", code.String()})
	if err != nil {
		fields = fields.AppendUnique(Fields{"grpc.error", fmt.Sprintf("%v", err)})
		if c.opts.errorToFieldsFunc != nil {
			fields = fields.AppendUnique(c.opts.errorToFieldsFunc(err))
		}
	}
	if c.opts.fieldsFromCtxCallMetaFn != nil {
		// fieldsFromCtxFn dups override the existing fields.
		fields = c.opts.fieldsFromCtxCallMetaFn(c.ctx, c.CallMeta).AppendUnique(fields)
	}
	c.logger.Log(c.ctx, c.opts.levelFunc(code), "finished call", fields.AppendUnique(c.opts.durationFieldFunc(duration))...)
}

func (c *reporter) PostMsgSend(payload any, err error, duration time.Duration) {
	logStartCall := !c.startCallLogged && has(c.opts.loggableEvents, StartCall)
	logPayloadSend := err == nil && has(c.opts.loggableEvents, PayloadSent)
	if !logStartCall && !logPayloadSend {
		return
	}

	logLvl := c.opts.levelFunc(c.opts.codeFunc(err))
	fields := c.fields.WithUnique(ExtractFields(c.ctx))
	if err != nil {
		fields = fields.AppendUnique(Fields{"grpc.error", fmt.Sprintf("%v", err)})
		if c.opts.errorToFieldsFunc != nil {
			fields = fields.AppendUnique(c.opts.errorToFieldsFunc(err))
		}
	}
	if c.opts.fieldsFromCtxCallMetaFn != nil {
		// fieldsFromCtxFn dups override the existing fields.
		fields = c.opts.fieldsFromCtxCallMetaFn(c.ctx, c.CallMeta).AppendUnique(fields)
	}
	if logStartCall {
		c.startCallLogged = true
		c.logger.Log(c.ctx, logLvl, "started call", fields.AppendUnique(c.opts.durationFieldFunc(duration))...)
	}

	if !logPayloadSend {
		return
	}
	callType := "response"
	if c.IsClient {
		callType = "request"
	}
	p, ok := payload.(proto.Message)
	if !ok {
		c.logger.Log(
			c.ctx,
			LevelError,
			"payload is not a google.golang.org/protobuf/proto.Message; programmatic error?",
			fields.AppendUnique(Fields{fmt.Sprintf("grpc.%s.type", callType), fmt.Sprintf("%T", payload)})...,
		)
		return
	}

	fields = fields.AppendUnique(Fields{"grpc.send.duration", duration.String(), fmt.Sprintf("grpc.%s.content", callType), p})
	fields = fields.AppendUnique(c.opts.durationFieldFunc(duration))
	c.logger.Log(c.ctx, logLvl, fmt.Sprintf("%s sent", callType), fields...)
}

func (c *reporter) PostMsgReceive(payload any, err error, duration time.Duration) {
	logStartCall := !c.startCallLogged && has(c.opts.loggableEvents, StartCall)
	logPayloadReceived := err == nil && has(c.opts.loggableEvents, PayloadReceived)
	if !logStartCall && !logPayloadReceived {
		return
	}

	logLvl := c.opts.levelFunc(c.opts.codeFunc(err))
	fields := c.fields.WithUnique(ExtractFields(c.ctx))
	if err != nil {
		fields = fields.AppendUnique(Fields{"grpc.error", fmt.Sprintf("%v", err)})
		if c.opts.errorToFieldsFunc != nil {
			fields = fields.AppendUnique(c.opts.errorToFieldsFunc(err))
		}
	}
	if c.opts.fieldsFromCtxCallMetaFn != nil {
		// fieldsFromCtxFn dups override the existing fields.
		fields = c.opts.fieldsFromCtxCallMetaFn(c.ctx, c.CallMeta).AppendUnique(fields)
	}
	if logStartCall {
		c.startCallLogged = true
		c.logger.Log(c.ctx, logLvl, "started call", fields.AppendUnique(c.opts.durationFieldFunc(duration))...)
	}

	if !logPayloadReceived {
		return
	}
	callType := "request"
	if c.IsClient {
		callType = "response"
	}
	p, ok := payload.(proto.Message)
	if !ok {
		c.logger.Log(
			c.ctx,
			LevelError,
			"payload is not a google.golang.org/protouf/proto.Message; programmatic error?",
			fields.AppendUnique(Fields{fmt.Sprintf("grpc.%s.type", callType), fmt.Sprintf("%T", payload)})...,
		)
		return
	}

	fields = fields.AppendUnique(Fields{"grpc.recv.duration", duration.String(), fmt.Sprintf("grpc.%s.content", callType), p})
	fields = fields.AppendUnique(c.opts.durationFieldFunc(duration))
	c.logger.Log(c.ctx, logLvl, fmt.Sprintf("%s received", callType), fields...)
}

func reportable(logger Logger, opts *options) interceptors.CommonReportableFunc {
	return func(ctx context.Context, c interceptors.CallMeta) (interceptors.Reporter, context.Context) {
		kind := KindServerFieldValue
		if c.IsClient {
			kind = KindClientFieldValue
		}

		// Field dups from context override the common fields.
		fields := newCommonFields(kind, c)
		if opts.disableGrpcLogFields != nil {
			fields = disableCommonLoggingFields(kind, c, opts.disableGrpcLogFields)
		}
		fields = fields.WithUnique(ExtractFields(ctx))

		if !c.IsClient {
			if peer, ok := peer.FromContext(ctx); ok {
				fields = append(fields, "peer.address", peer.Addr.String())
			}
		}
		if opts.fieldsFromCtxCallMetaFn != nil {
			// fieldsFromCtxFn dups override the existing fields.
			fields = opts.fieldsFromCtxCallMetaFn(ctx, c).AppendUnique(fields)
		}

		singleUseFields := Fields{"grpc.start_time", time.Now().Format(opts.timestampFormat)}
		if d, ok := ctx.Deadline(); ok {
			singleUseFields = singleUseFields.AppendUnique(Fields{"grpc.request.deadline", d.Format(opts.timestampFormat)})
		}
		ctx = InjectFields(ctx, fields)
		return &reporter{
			CallMeta:        c,
			ctx:             ctx,
			startCallLogged: false,
			opts:            opts,
			fields:          fields.WithUnique(singleUseFields),
			logger:          logger,
			kind:            kind,
		}, ctx
	}
}

// UnaryClientInterceptor returns a new unary client interceptor that optionally logs the execution of external gRPC calls.
// Logger will read existing and write new logging.Fields available in current context.
// See `ExtractFields` and `InjectFields` for details.
func UnaryClientInterceptor(logger Logger, opts ...Option) grpc.UnaryClientInterceptor {
	o := evaluateClientOpt(opts)
	return interceptors.UnaryClientInterceptor(reportable(logger, o))
}

// StreamClientInterceptor returns a new streaming client interceptor that optionally logs the execution of external gRPC calls.
// Logger will read existing and write new logging.Fields available in current context.
// See `ExtractFields` and `InjectFields` for details.
func StreamClientInterceptor(logger Logger, opts ...Option) grpc.StreamClientInterceptor {
	o := evaluateClientOpt(opts)
	return interceptors.StreamClientInterceptor(reportable(logger, o))
}

// UnaryServerInterceptor returns a new unary server interceptors that optionally logs endpoint handling.
// Logger will read existing and write new logging.Fields available in current context.
// See `ExtractFields` and `InjectFields` for details.
func UnaryServerInterceptor(logger Logger, opts ...Option) grpc.UnaryServerInterceptor {
	o := evaluateServerOpt(opts)
	return interceptors.UnaryServerInterceptor(reportable(logger, o))
}

// StreamServerInterceptor returns a new stream server interceptors that optionally logs endpoint handling.
// Logger will read existing and write new logging.Fields available in current context.
// See `ExtractFields` and `InjectFields` for details..
func StreamServerInterceptor(logger Logger, opts ...Option) grpc.StreamServerInterceptor {
	o := evaluateServerOpt(opts)
	return interceptors.StreamServerInterceptor(reportable(logger, o))
}
