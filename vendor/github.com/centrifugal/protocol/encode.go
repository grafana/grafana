package protocol

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"

	"github.com/gogo/protobuf/proto"
)

// PushEncoder ...
type PushEncoder interface {
	Encode(*Push) ([]byte, error)
	EncodeMessage(*Message) ([]byte, error)
	EncodePublication(*Publication) ([]byte, error)
	EncodeJoin(*Join) ([]byte, error)
	EncodeLeave(*Leave) ([]byte, error)
	EncodeUnsub(*Unsub) ([]byte, error)
	EncodeSub(*Sub) ([]byte, error)
}

// JSONPushEncoder ...
type JSONPushEncoder struct {
}

// NewJSONPushEncoder ...
func NewJSONPushEncoder() *JSONPushEncoder {
	return &JSONPushEncoder{}
}

// Encode ...
func (e *JSONPushEncoder) Encode(message *Push) ([]byte, error) {
	return json.Marshal(message)
}

// EncodePublication ...
func (e *JSONPushEncoder) EncodePublication(message *Publication) ([]byte, error) {
	return json.Marshal(message)
}

// EncodeMessage ...
func (e *JSONPushEncoder) EncodeMessage(message *Message) ([]byte, error) {
	return json.Marshal(message)
}

// EncodeJoin ...
func (e *JSONPushEncoder) EncodeJoin(message *Join) ([]byte, error) {
	return json.Marshal(message)
}

// EncodeLeave ...
func (e *JSONPushEncoder) EncodeLeave(message *Leave) ([]byte, error) {
	return json.Marshal(message)
}

// EncodeUnsub ...
func (e *JSONPushEncoder) EncodeUnsub(message *Unsub) ([]byte, error) {
	return json.Marshal(message)
}

// EncodeSub ...
func (e *JSONPushEncoder) EncodeSub(message *Sub) ([]byte, error) {
	return json.Marshal(message)
}

// ProtobufPushEncoder ...
type ProtobufPushEncoder struct {
}

// NewProtobufPushEncoder ...
func NewProtobufPushEncoder() *ProtobufPushEncoder {
	return &ProtobufPushEncoder{}
}

// Encode ...
func (e *ProtobufPushEncoder) Encode(message *Push) ([]byte, error) {
	return message.Marshal()
}

// EncodePublication ...
func (e *ProtobufPushEncoder) EncodePublication(message *Publication) ([]byte, error) {
	return message.Marshal()
}

// EncodeMessage ...
func (e *ProtobufPushEncoder) EncodeMessage(message *Message) ([]byte, error) {
	return message.Marshal()
}

// EncodeJoin ...
func (e *ProtobufPushEncoder) EncodeJoin(message *Join) ([]byte, error) {
	return message.Marshal()
}

// EncodeLeave ...
func (e *ProtobufPushEncoder) EncodeLeave(message *Leave) ([]byte, error) {
	return message.Marshal()
}

// EncodeUnsub ...
func (e *ProtobufPushEncoder) EncodeUnsub(message *Unsub) ([]byte, error) {
	return message.Marshal()
}

// EncodeSub ...
func (e *ProtobufPushEncoder) EncodeSub(message *Sub) ([]byte, error) {
	return message.Marshal()
}

// ReplyEncoder ...
type ReplyEncoder interface {
	Reset()
	Encode(*Reply) error
	Finish() []byte
}

// JSONReplyEncoder ...
type JSONReplyEncoder struct {
	buffer bytes.Buffer
}

// NewJSONReplyEncoder ...
func NewJSONReplyEncoder() *JSONReplyEncoder {
	return &JSONReplyEncoder{}
}

// Reset ...
func (e *JSONReplyEncoder) Reset() {
	e.buffer.Reset()
}

// Encode ...
func (e *JSONReplyEncoder) Encode(r *Reply) error {
	data, err := json.Marshal(r)
	if err != nil {
		return err
	}
	e.buffer.Write(data)
	e.buffer.WriteString("\n")
	return nil
}

// Finish ...
func (e *JSONReplyEncoder) Finish() []byte {
	data := e.buffer.Bytes()
	dataCopy := make([]byte, len(data))
	copy(dataCopy, data)
	return dataCopy
}

// ProtobufReplyEncoder ...
type ProtobufReplyEncoder struct {
	buffer bytes.Buffer
}

// NewProtobufReplyEncoder ...
func NewProtobufReplyEncoder() *ProtobufReplyEncoder {
	return &ProtobufReplyEncoder{}
}

// Encode ...
func (e *ProtobufReplyEncoder) Encode(r *Reply) error {
	replyBytes, err := r.Marshal()
	if err != nil {
		return err
	}
	bs := make([]byte, 8)
	n := binary.PutUvarint(bs, uint64(len(replyBytes)))
	e.buffer.Write(bs[:n])
	e.buffer.Write(replyBytes)
	return nil
}

// Reset ...
func (e *ProtobufReplyEncoder) Reset() {
	e.buffer.Reset()
}

// Finish ...
func (e *ProtobufReplyEncoder) Finish() []byte {
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
	return json.Marshal(res)
}

// EncodeRefreshResult ...
func (e *JSONResultEncoder) EncodeRefreshResult(res *RefreshResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodeSubscribeResult ...
func (e *JSONResultEncoder) EncodeSubscribeResult(res *SubscribeResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodeSubRefreshResult ...
func (e *JSONResultEncoder) EncodeSubRefreshResult(res *SubRefreshResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodeUnsubscribeResult ...
func (e *JSONResultEncoder) EncodeUnsubscribeResult(res *UnsubscribeResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodePublishResult ...
func (e *JSONResultEncoder) EncodePublishResult(res *PublishResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodePresenceResult ...
func (e *JSONResultEncoder) EncodePresenceResult(res *PresenceResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodePresenceStatsResult ...
func (e *JSONResultEncoder) EncodePresenceStatsResult(res *PresenceStatsResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodeHistoryResult ...
func (e *JSONResultEncoder) EncodeHistoryResult(res *HistoryResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodePingResult ...
func (e *JSONResultEncoder) EncodePingResult(res *PingResult) ([]byte, error) {
	return json.Marshal(res)
}

// EncodeRPCResult ...
func (e *JSONResultEncoder) EncodeRPCResult(res *RPCResult) ([]byte, error) {
	return json.Marshal(res)
}

// ProtobufResultEncoder ...
type ProtobufResultEncoder struct{}

// NewProtobufResultEncoder ...
func NewProtobufResultEncoder() *ProtobufResultEncoder {
	return &ProtobufResultEncoder{}
}

// EncodeConnectResult ...
func (e *ProtobufResultEncoder) EncodeConnectResult(res *ConnectResult) ([]byte, error) {
	return res.Marshal()
}

// EncodeRefreshResult ...
func (e *ProtobufResultEncoder) EncodeRefreshResult(res *RefreshResult) ([]byte, error) {
	return res.Marshal()
}

// EncodeSubscribeResult ...
func (e *ProtobufResultEncoder) EncodeSubscribeResult(res *SubscribeResult) ([]byte, error) {
	return res.Marshal()
}

// EncodeSubRefreshResult ...
func (e *ProtobufResultEncoder) EncodeSubRefreshResult(res *SubRefreshResult) ([]byte, error) {
	return res.Marshal()
}

// EncodeUnsubscribeResult ...
func (e *ProtobufResultEncoder) EncodeUnsubscribeResult(res *UnsubscribeResult) ([]byte, error) {
	return res.Marshal()
}

// EncodePublishResult ...
func (e *ProtobufResultEncoder) EncodePublishResult(res *PublishResult) ([]byte, error) {
	return res.Marshal()
}

// EncodePresenceResult ...
func (e *ProtobufResultEncoder) EncodePresenceResult(res *PresenceResult) ([]byte, error) {
	return res.Marshal()
}

// EncodePresenceStatsResult ...
func (e *ProtobufResultEncoder) EncodePresenceStatsResult(res *PresenceStatsResult) ([]byte, error) {
	return res.Marshal()
}

// EncodeHistoryResult ...
func (e *ProtobufResultEncoder) EncodeHistoryResult(res *HistoryResult) ([]byte, error) {
	return res.Marshal()
}

// EncodePingResult ...
func (e *ProtobufResultEncoder) EncodePingResult(res *PingResult) ([]byte, error) {
	return res.Marshal()
}

// EncodeRPCResult ...
func (e *ProtobufResultEncoder) EncodeRPCResult(res *RPCResult) ([]byte, error) {
	return res.Marshal()
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
	return json.Marshal(cmd)
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
	commandBytes, err := cmd.Marshal()
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

// ParamsEncoder ...
type ParamsEncoder interface {
	Encode(request interface{}) ([]byte, error)
}

// JSONParamsEncoder ...
type JSONParamsEncoder struct{}

// NewJSONParamsEncoder ...
func NewJSONParamsEncoder() *JSONParamsEncoder {
	return &JSONParamsEncoder{}
}

// Encode ...
func (d *JSONParamsEncoder) Encode(r interface{}) ([]byte, error) {
	return json.Marshal(r)
}

// ProtobufParamsEncoder ...
type ProtobufParamsEncoder struct{}

// NewProtobufParamsEncoder ...
func NewProtobufParamsEncoder() *ProtobufParamsEncoder {
	return &ProtobufParamsEncoder{}
}

// Encode ...
func (d *ProtobufParamsEncoder) Encode(r interface{}) ([]byte, error) {
	m, ok := r.(proto.Marshaler)
	if !ok {
		return nil, fmt.Errorf("can not marshal type %T to Protobuf", r)
	}
	return m.Marshal()
}
