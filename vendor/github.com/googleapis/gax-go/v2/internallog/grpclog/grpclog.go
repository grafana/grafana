// Copyright 2024, Google Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//     * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// Package grpclog in intended for internal use by generated clients only.
package grpclog

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"

	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// ProtoMessageRequest returns a lazily evaluated [slog.LogValuer] for
// the provided message. The context is used to extract outgoing headers.
func ProtoMessageRequest(ctx context.Context, msg proto.Message) slog.LogValuer {
	return &protoMessage{ctx: ctx, msg: msg}
}

// ProtoMessageResponse returns a lazily evaluated [slog.LogValuer] for
// the provided message.
func ProtoMessageResponse(msg proto.Message) slog.LogValuer {
	return &protoMessage{msg: msg}
}

type protoMessage struct {
	ctx context.Context
	msg proto.Message
}

func (m *protoMessage) LogValue() slog.Value {
	if m == nil || m.msg == nil {
		return slog.Value{}
	}

	var groupValueAttrs []slog.Attr

	if m.ctx != nil {
		var headerAttr []slog.Attr
		if m, ok := metadata.FromOutgoingContext(m.ctx); ok {
			for k, v := range m {
				headerAttr = append(headerAttr, slog.String(k, strings.Join(v, ",")))
			}
		}
		if len(headerAttr) > 0 {
			groupValueAttrs = append(groupValueAttrs, slog.Any("headers", headerAttr))
		}
	}
	mo := protojson.MarshalOptions{AllowPartial: true, UseEnumNumbers: true}
	if b, err := mo.Marshal(m.msg); err == nil {
		var m map[string]any
		if err := json.Unmarshal(b, &m); err == nil {
			groupValueAttrs = append(groupValueAttrs, slog.Any("payload", m))
		}
	}

	return slog.GroupValue(groupValueAttrs...)
}
