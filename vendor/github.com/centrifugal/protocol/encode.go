package protocol

import (
	"bytes"
	"encoding/binary"
	"errors"
	fastJSON "github.com/segmentio/encoding/json"
)

var errInvalidJSON = errors.New("invalid JSON data")

// checks that JSON is valid.
func isValidJSON(b []byte) error {
	if b == nil {
		return nil
	}
	if !fastJSON.Valid(b) {
		return errInvalidJSON
	}
	return nil
}

// PushEncoder ...
type PushEncoder interface {
	Encode(*Push) ([]byte, error)
	EncodeMessage(*Message, ...[]byte) ([]byte, error)
	EncodePublication(*Publication, ...[]byte) ([]byte, error)
	EncodeJoin(*Join, ...[]byte) ([]byte, error)
	EncodeLeave(*Leave, ...[]byte) ([]byte, error)
	EncodeUnsubscribe(*Unsubscribe, ...[]byte) ([]byte, error)
	EncodeSubscribe(*Subscribe, ...[]byte) ([]byte, error)
	EncodeConnect(*Connect, ...[]byte) ([]byte, error)
	EncodeDisconnect(*Disconnect, ...[]byte) ([]byte, error)
	EncodeRefresh(*Refresh, ...[]byte) ([]byte, error)
}

var _ PushEncoder = (*JSONPushEncoder)(nil)
var _ PushEncoder = (*ProtobufPushEncoder)(nil)

// JSONPushEncoder ...
type JSONPushEncoder struct {
}

// NewJSONPushEncoder ...
func NewJSONPushEncoder() *JSONPushEncoder {
	return &JSONPushEncoder{}
}

// Encode Push to bytes.
func (e *JSONPushEncoder) Encode(message *Push) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	res, err := jw.BuildBytes()
	if err != nil {
		return nil, err
	}
	if err := isValidJSON(res); err != nil {
		return nil, err
	}
	return res, nil
}

// EncodePublication to bytes.
func (e *JSONPushEncoder) EncodePublication(message *Publication, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeMessage to bytes.
func (e *JSONPushEncoder) EncodeMessage(message *Message, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeJoin to bytes.
func (e *JSONPushEncoder) EncodeJoin(message *Join, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeLeave to bytes.
func (e *JSONPushEncoder) EncodeLeave(message *Leave, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeUnsubscribe to bytes.
func (e *JSONPushEncoder) EncodeUnsubscribe(message *Unsubscribe, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeSubscribe to bytes.
func (e *JSONPushEncoder) EncodeSubscribe(message *Subscribe, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeConnect to bytes.
func (e *JSONPushEncoder) EncodeConnect(message *Connect, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeDisconnect to bytes.
func (e *JSONPushEncoder) EncodeDisconnect(message *Disconnect, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// EncodeRefresh to bytes.
func (e *JSONPushEncoder) EncodeRefresh(message *Refresh, reuse ...[]byte) ([]byte, error) {
	jw := newWriter()
	message.MarshalEasyJSON(jw)
	return jw.BuildBytes(reuse...)
}

// ProtobufPushEncoder ...
type ProtobufPushEncoder struct {
}

// NewProtobufPushEncoder ...
func NewProtobufPushEncoder() *ProtobufPushEncoder {
	return &ProtobufPushEncoder{}
}

// Encode Push to bytes.
func (e *ProtobufPushEncoder) Encode(message *Push) ([]byte, error) {
	return message.MarshalVT()
}

// EncodePublication to bytes.
func (e *ProtobufPushEncoder) EncodePublication(message *Publication, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeMessage to bytes.
func (e *ProtobufPushEncoder) EncodeMessage(message *Message, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeJoin to bytes.
func (e *ProtobufPushEncoder) EncodeJoin(message *Join, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeLeave to bytes.
func (e *ProtobufPushEncoder) EncodeLeave(message *Leave, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeUnsubscribe to bytes.
func (e *ProtobufPushEncoder) EncodeUnsubscribe(message *Unsubscribe, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeSubscribe to bytes.
func (e *ProtobufPushEncoder) EncodeSubscribe(message *Subscribe, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeConnect to bytes.
func (e *ProtobufPushEncoder) EncodeConnect(message *Connect, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeDisconnect to bytes.
func (e *ProtobufPushEncoder) EncodeDisconnect(message *Disconnect, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// EncodeRefresh to bytes.
func (e *ProtobufPushEncoder) EncodeRefresh(message *Refresh, reuse ...[]byte) ([]byte, error) {
	if len(reuse) == 1 {
		size := message.SizeVT()
		if cap(reuse[0]) >= size {
			n, err := message.MarshalToSizedBufferVT(reuse[0][:size])
			if err != nil {
				return nil, err
			}
			return reuse[0][:n], nil
		}
	}
	return message.MarshalVT()
}

// ReplyEncoder ...
type ReplyEncoder interface {
	Encode(*Reply) ([]byte, error)
}

// JSONReplyEncoder ...
type JSONReplyEncoder struct{}

// NewJSONReplyEncoder ...
func NewJSONReplyEncoder() *JSONReplyEncoder {
	return &JSONReplyEncoder{}
}

// Encode Reply to bytes.
func (e *JSONReplyEncoder) Encode(r *Reply) ([]byte, error) {
	jw := newWriter()
	r.MarshalEasyJSON(jw)
	result, err := jw.BuildBytes()
	if err != nil {
		return nil, err
	}
	if err := isValidJSON(result); err != nil {
		return nil, err
	}
	return result, nil
}

//func (e *JSONReplyEncoder) EncodeNoCopy(r *Reply, _ []byte) ([]byte, error) {
//	// No copy is not supported for JSON encoding. Just use Encode method, ignore pre-allocated buffer.
//	return e.Encode(r)
//}

// ProtobufReplyEncoder ...
type ProtobufReplyEncoder struct{}

// NewProtobufReplyEncoder ...
func NewProtobufReplyEncoder() *ProtobufReplyEncoder {
	return &ProtobufReplyEncoder{}
}

// Encode Reply to bytes.
func (e *ProtobufReplyEncoder) Encode(r *Reply) ([]byte, error) {
	return r.MarshalVT()
}

//// EncodeNoCopy Reply to bytes without making copy of buffer byte slice.
//func (e *ProtobufReplyEncoder) EncodeNoCopy(r *Reply, buf []byte) ([]byte, error) {
//	size := r.SizeVT()
//	n, err := r.MarshalToSizedBufferVT(buf[:size])
//	if err != nil {
//		return nil, err
//	}
//	return buf[:n], nil
//}

// DataEncoder ...
type DataEncoder interface {
	Reset()
	Encode([]byte) error
	Finish() []byte
}

// JSONDataEncoder ...
type JSONDataEncoder struct {
	count  int
	buffer bytes.Buffer
}

// NewJSONDataEncoder ...
func NewJSONDataEncoder() *JSONDataEncoder {
	return &JSONDataEncoder{}
}

// Reset ...
func (e *JSONDataEncoder) Reset() {
	e.count = 0
	e.buffer.Reset()
}

// Encode ...
func (e *JSONDataEncoder) Encode(data []byte) error {
	if e.count > 0 {
		e.buffer.WriteString("\n")
	}
	e.buffer.Write(data)
	e.count++
	return nil
}

// Finish ...
func (e *JSONDataEncoder) Finish() []byte {
	data := e.buffer.Bytes()
	dataCopy := make([]byte, len(data))
	copy(dataCopy, data)
	return dataCopy
}

// ProtobufDataEncoder ...
type ProtobufDataEncoder struct {
	buffer bytes.Buffer
}

// NewProtobufDataEncoder ...
func NewProtobufDataEncoder() *ProtobufDataEncoder {
	return &ProtobufDataEncoder{}
}

// Encode ...
func (e *ProtobufDataEncoder) Encode(data []byte) error {
	bs := make([]byte, 8)
	n := binary.PutUvarint(bs, uint64(len(data)))
	e.buffer.Write(bs[:n])
	e.buffer.Write(data)
	return nil
}

// Reset ...
func (e *ProtobufDataEncoder) Reset() {
	e.buffer.Reset()
}

// Finish ...
func (e *ProtobufDataEncoder) Finish() []byte {
	data := e.buffer.Bytes()
	dataCopy := make([]byte, len(data))
	copy(dataCopy, data)
	return dataCopy
}

// ResultEncoder ...
type ResultEncoder interface {
	EncodeConnectResult(*ConnectResult) ([]byte, error)
	EncodeRefreshResult(*RefreshResult) ([]byte, error)
	EncodeSubscribeResult(*SubscribeResult) ([]byte, error)
	EncodeSubRefreshResult(*SubRefreshResult) ([]byte, error)
	EncodeUnsubscribeResult(*UnsubscribeResult) ([]byte, error)
	EncodePublishResult(*PublishResult) ([]byte, error)
	EncodePresenceResult(*PresenceResult) ([]byte, error)
	EncodePresenceStatsResult(*PresenceStatsResult) ([]byte, error)
	EncodeHistoryResult(*HistoryResult) ([]byte, error)
	EncodePingResult(*PingResult) ([]byte, error)
	EncodeRPCResult(*RPCResult) ([]byte, error)
}

// JSONResultEncoder ...
type JSONResultEncoder struct{}

// NewJSONResultEncoder ...
func NewJSONResultEncoder() *JSONResultEncoder {
	return &JSONResultEncoder{}
}

// EncodeConnectResult ...
func (e *JSONResultEncoder) EncodeConnectResult(res *ConnectResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodeRefreshResult ...
func (e *JSONResultEncoder) EncodeRefreshResult(res *RefreshResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodeSubscribeResult ...
func (e *JSONResultEncoder) EncodeSubscribeResult(res *SubscribeResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodeSubRefreshResult ...
func (e *JSONResultEncoder) EncodeSubRefreshResult(res *SubRefreshResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodeUnsubscribeResult ...
func (e *JSONResultEncoder) EncodeUnsubscribeResult(res *UnsubscribeResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodePublishResult ...
func (e *JSONResultEncoder) EncodePublishResult(res *PublishResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodePresenceResult ...
func (e *JSONResultEncoder) EncodePresenceResult(res *PresenceResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodePresenceStatsResult ...
func (e *JSONResultEncoder) EncodePresenceStatsResult(res *PresenceStatsResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodeHistoryResult ...
func (e *JSONResultEncoder) EncodeHistoryResult(res *HistoryResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodePingResult ...
func (e *JSONResultEncoder) EncodePingResult(res *PingResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// EncodeRPCResult ...
func (e *JSONResultEncoder) EncodeRPCResult(res *RPCResult) ([]byte, error) {
	jw := newWriter()
	res.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// ProtobufResultEncoder ...
type ProtobufResultEncoder struct{}

// NewProtobufResultEncoder ...
func NewProtobufResultEncoder() *ProtobufResultEncoder {
	return &ProtobufResultEncoder{}
}

// EncodeConnectResult ...
func (e *ProtobufResultEncoder) EncodeConnectResult(res *ConnectResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodeRefreshResult ...
func (e *ProtobufResultEncoder) EncodeRefreshResult(res *RefreshResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodeSubscribeResult ...
func (e *ProtobufResultEncoder) EncodeSubscribeResult(res *SubscribeResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodeSubRefreshResult ...
func (e *ProtobufResultEncoder) EncodeSubRefreshResult(res *SubRefreshResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodeUnsubscribeResult ...
func (e *ProtobufResultEncoder) EncodeUnsubscribeResult(res *UnsubscribeResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodePublishResult ...
func (e *ProtobufResultEncoder) EncodePublishResult(res *PublishResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodePresenceResult ...
func (e *ProtobufResultEncoder) EncodePresenceResult(res *PresenceResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodePresenceStatsResult ...
func (e *ProtobufResultEncoder) EncodePresenceStatsResult(res *PresenceStatsResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodeHistoryResult ...
func (e *ProtobufResultEncoder) EncodeHistoryResult(res *HistoryResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodePingResult ...
func (e *ProtobufResultEncoder) EncodePingResult(res *PingResult) ([]byte, error) {
	return res.MarshalVT()
}

// EncodeRPCResult ...
func (e *ProtobufResultEncoder) EncodeRPCResult(res *RPCResult) ([]byte, error) {
	return res.MarshalVT()
}

// CommandEncoder ...
type CommandEncoder interface {
	Encode(cmd *Command) ([]byte, error)
}

// JSONCommandEncoder ...
type JSONCommandEncoder struct {
}

// NewJSONCommandEncoder ...
func NewJSONCommandEncoder() *JSONCommandEncoder {
	return &JSONCommandEncoder{}
}

// Encode ...
func (e *JSONCommandEncoder) Encode(cmd *Command) ([]byte, error) {
	jw := newWriter()
	cmd.MarshalEasyJSON(jw)
	return jw.BuildBytes()
}

// ProtobufCommandEncoder ...
type ProtobufCommandEncoder struct {
}

// NewProtobufCommandEncoder ...
func NewProtobufCommandEncoder() *ProtobufCommandEncoder {
	return &ProtobufCommandEncoder{}
}

// Encode ...
func (e *ProtobufCommandEncoder) Encode(cmd *Command) ([]byte, error) {
	commandBytes, err := cmd.MarshalVT()
	if err != nil {
		return nil, err
	}
	bs := make([]byte, 8)
	n := binary.PutUvarint(bs, uint64(len(commandBytes)))
	var buf bytes.Buffer
	buf.Write(bs[:n])
	buf.Write(commandBytes)
	return buf.Bytes(), nil
}
