package protocol

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/gogo/protobuf/proto"
)

// UnmarshalJSON helps to unmarshal comamnd method when set as string.
func (x *MethodType) UnmarshalJSON(data []byte) error {
	val, err := strconv.Atoi(string(data))
	if err != nil {
		method := strings.Trim(strings.ToUpper(string(data)), `"`)
		if v, ok := MethodType_value[method]; ok {
			*x = MethodType(v)
			return nil
		}
		return err
	}
	*x = MethodType(val)
	return nil
}

// PushDecoder ...
type PushDecoder interface {
	Decode([]byte) (*Push, error)
	DecodePublication([]byte) (*Publication, error)
	DecodeJoin([]byte) (*Join, error)
	DecodeLeave([]byte) (*Leave, error)
	DecodeMessage([]byte) (*Message, error)
	DecodeUnsub([]byte) (*Unsub, error)
	DecodeSub([]byte) (*Sub, error)
}

// JSONPushDecoder ...
type JSONPushDecoder struct {
}

// NewJSONPushDecoder ...
func NewJSONPushDecoder() *JSONPushDecoder {
	return &JSONPushDecoder{}
}

// Decode ...
func (e *JSONPushDecoder) Decode(data []byte) (*Push, error) {
	var m Push
	err := json.Unmarshal(data, &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodePublication ...
func (e *JSONPushDecoder) DecodePublication(data []byte) (*Publication, error) {
	var m Publication
	err := json.Unmarshal(data, &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeJoin ...
func (e *JSONPushDecoder) DecodeJoin(data []byte) (*Join, error) {
	var m Join
	err := json.Unmarshal(data, &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeLeave  ...
func (e *JSONPushDecoder) DecodeLeave(data []byte) (*Leave, error) {
	var m Leave
	err := json.Unmarshal(data, &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeMessage ...
func (e *JSONPushDecoder) DecodeMessage(data []byte) (*Message, error) {
	var m Message
	err := json.Unmarshal(data, &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeUnsub ...
func (e *JSONPushDecoder) DecodeUnsub(data []byte) (*Unsub, error) {
	var m Unsub
	err := json.Unmarshal(data, &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeSub ...
func (e *JSONPushDecoder) DecodeSub(data []byte) (*Sub, error) {
	var m Sub
	err := json.Unmarshal(data, &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ProtobufPushDecoder ...
type ProtobufPushDecoder struct {
}

// NewProtobufPushDecoder ...
func NewProtobufPushDecoder() *ProtobufPushDecoder {
	return &ProtobufPushDecoder{}
}

// Decode ...
func (e *ProtobufPushDecoder) Decode(data []byte) (*Push, error) {
	var m Push
	err := m.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodePublication ...
func (e *ProtobufPushDecoder) DecodePublication(data []byte) (*Publication, error) {
	var m Publication
	err := m.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeJoin ...
func (e *ProtobufPushDecoder) DecodeJoin(data []byte) (*Join, error) {
	var m Join
	err := m.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeLeave  ...
func (e *ProtobufPushDecoder) DecodeLeave(data []byte) (*Leave, error) {
	var m Leave
	err := m.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeMessage ...
func (e *ProtobufPushDecoder) DecodeMessage(data []byte) (*Message, error) {
	var m Message
	err := m.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeUnsub ...
func (e *ProtobufPushDecoder) DecodeUnsub(data []byte) (*Unsub, error) {
	var m Unsub
	err := m.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// DecodeSub ...
func (e *ProtobufPushDecoder) DecodeSub(data []byte) (*Sub, error) {
	var m Sub
	err := m.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// CommandDecoder ...
type CommandDecoder interface {
	Reset([]byte) error
	Decode() (*Command, error)
}

// JSONCommandDecoder ...
type JSONCommandDecoder struct {
	decoder *json.Decoder
}

// NewJSONCommandDecoder ...
func NewJSONCommandDecoder(data []byte) *JSONCommandDecoder {
	return &JSONCommandDecoder{
		decoder: json.NewDecoder(bytes.NewReader(data)),
	}
}

// Reset ...
func (d *JSONCommandDecoder) Reset(data []byte) error {
	d.decoder = json.NewDecoder(bytes.NewReader(data))
	return nil
}

// Decode ...
func (d *JSONCommandDecoder) Decode() (*Command, error) {
	var c Command
	err := d.decoder.Decode(&c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ProtobufCommandDecoder ...
type ProtobufCommandDecoder struct {
	data   []byte
	offset int
}

// NewProtobufCommandDecoder ...
func NewProtobufCommandDecoder(data []byte) *ProtobufCommandDecoder {
	return &ProtobufCommandDecoder{
		data: data,
	}
}

// Reset ...
func (d *ProtobufCommandDecoder) Reset(data []byte) error {
	d.data = data
	d.offset = 0
	return nil
}

// Decode ...
func (d *ProtobufCommandDecoder) Decode() (*Command, error) {
	if d.offset < len(d.data) {
		var c Command
		l, n := binary.Uvarint(d.data[d.offset:])
		cmdBytes := d.data[d.offset+n : d.offset+n+int(l)]
		err := c.Unmarshal(cmdBytes)
		if err != nil {
			return nil, err
		}
		d.offset = d.offset + n + int(l)
		return &c, nil
	}
	return nil, io.EOF
}

// ParamsDecoder ...
type ParamsDecoder interface {
	DecodeConnect([]byte) (*ConnectRequest, error)
	DecodeRefresh([]byte) (*RefreshRequest, error)
	DecodeSubscribe([]byte) (*SubscribeRequest, error)
	DecodeSubRefresh([]byte) (*SubRefreshRequest, error)
	DecodeUnsubscribe([]byte) (*UnsubscribeRequest, error)
	DecodePublish([]byte) (*PublishRequest, error)
	DecodePresence([]byte) (*PresenceRequest, error)
	DecodePresenceStats([]byte) (*PresenceStatsRequest, error)
	DecodeHistory([]byte) (*HistoryRequest, error)
	DecodePing([]byte) (*PingRequest, error)
	DecodeRPC([]byte) (*RPCRequest, error)
	DecodeSend([]byte) (*SendRequest, error)
}

// JSONParamsDecoder ...
type JSONParamsDecoder struct{}

// NewJSONParamsDecoder ...
func NewJSONParamsDecoder() *JSONParamsDecoder {
	return &JSONParamsDecoder{}
}

// DecodeConnect ...
func (d *JSONParamsDecoder) DecodeConnect(data []byte) (*ConnectRequest, error) {
	var p ConnectRequest
	if data != nil {
		err := json.Unmarshal(data, &p)
		if err != nil {
			return nil, err
		}
	}
	return &p, nil
}

// DecodeRefresh ...
func (d *JSONParamsDecoder) DecodeRefresh(data []byte) (*RefreshRequest, error) {
	var p RefreshRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeSubscribe ...
func (d *JSONParamsDecoder) DecodeSubscribe(data []byte) (*SubscribeRequest, error) {
	var p SubscribeRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeSubRefresh ...
func (d *JSONParamsDecoder) DecodeSubRefresh(data []byte) (*SubRefreshRequest, error) {
	var p SubRefreshRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeUnsubscribe ...
func (d *JSONParamsDecoder) DecodeUnsubscribe(data []byte) (*UnsubscribeRequest, error) {
	var p UnsubscribeRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePublish ...
func (d *JSONParamsDecoder) DecodePublish(data []byte) (*PublishRequest, error) {
	var p PublishRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePresence ...
func (d *JSONParamsDecoder) DecodePresence(data []byte) (*PresenceRequest, error) {
	var p PresenceRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePresenceStats ...
func (d *JSONParamsDecoder) DecodePresenceStats(data []byte) (*PresenceStatsRequest, error) {
	var p PresenceStatsRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeHistory ...
func (d *JSONParamsDecoder) DecodeHistory(data []byte) (*HistoryRequest, error) {
	var p HistoryRequest
	err := json.Unmarshal(data, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePing ...
func (d *JSONParamsDecoder) DecodePing(data []byte) (*PingRequest, error) {
	var p PingRequest
	if data != nil {
		err := json.Unmarshal(data, &p)
		if err != nil {
			return nil, err
		}
	}
	return &p, nil
}

// DecodeRPC ...
func (d *JSONParamsDecoder) DecodeRPC(data []byte) (*RPCRequest, error) {
	var p RPCRequest
	if data != nil {
		err := json.Unmarshal(data, &p)
		if err != nil {
			return nil, err
		}
	}
	return &p, nil
}

// DecodeSend ...
func (d *JSONParamsDecoder) DecodeSend(data []byte) (*SendRequest, error) {
	var p SendRequest
	if data != nil {
		err := json.Unmarshal(data, &p)
		if err != nil {
			return nil, err
		}
	}
	return &p, nil
}

// ProtobufParamsDecoder ...
type ProtobufParamsDecoder struct{}

// NewProtobufParamsDecoder ...
func NewProtobufParamsDecoder() *ProtobufParamsDecoder {
	return &ProtobufParamsDecoder{}
}

// DecodeConnect ...
func (d *ProtobufParamsDecoder) DecodeConnect(data []byte) (*ConnectRequest, error) {
	var p ConnectRequest
	if data != nil {
		err := p.Unmarshal(data)
		if err != nil {
			return nil, err
		}
	}
	return &p, nil
}

// DecodeRefresh ...
func (d *ProtobufParamsDecoder) DecodeRefresh(data []byte) (*RefreshRequest, error) {
	var p RefreshRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeSubscribe ...
func (d *ProtobufParamsDecoder) DecodeSubscribe(data []byte) (*SubscribeRequest, error) {
	var p SubscribeRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeSubRefresh ...
func (d *ProtobufParamsDecoder) DecodeSubRefresh(data []byte) (*SubRefreshRequest, error) {
	var p SubRefreshRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeUnsubscribe ...
func (d *ProtobufParamsDecoder) DecodeUnsubscribe(data []byte) (*UnsubscribeRequest, error) {
	var p UnsubscribeRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePublish ...
func (d *ProtobufParamsDecoder) DecodePublish(data []byte) (*PublishRequest, error) {
	var p PublishRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePresence ...
func (d *ProtobufParamsDecoder) DecodePresence(data []byte) (*PresenceRequest, error) {
	var p PresenceRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePresenceStats ...
func (d *ProtobufParamsDecoder) DecodePresenceStats(data []byte) (*PresenceStatsRequest, error) {
	var p PresenceStatsRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeHistory ...
func (d *ProtobufParamsDecoder) DecodeHistory(data []byte) (*HistoryRequest, error) {
	var p HistoryRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodePing ...
func (d *ProtobufParamsDecoder) DecodePing(data []byte) (*PingRequest, error) {
	var p PingRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeRPC ...
func (d *ProtobufParamsDecoder) DecodeRPC(data []byte) (*RPCRequest, error) {
	var p RPCRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DecodeSend ...
func (d *ProtobufParamsDecoder) DecodeSend(data []byte) (*SendRequest, error) {
	var p SendRequest
	err := p.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ReplyDecoder ...
type ReplyDecoder interface {
	Reset([]byte) error
	Decode() (*Reply, error)
}

// JSONReplyDecoder ...
type JSONReplyDecoder struct {
	decoder *json.Decoder
}

// NewJSONReplyDecoder ...
func NewJSONReplyDecoder(data []byte) *JSONReplyDecoder {
	return &JSONReplyDecoder{
		decoder: json.NewDecoder(bytes.NewReader(data)),
	}
}

// Reset ...
func (d *JSONReplyDecoder) Reset(data []byte) error {
	d.decoder = json.NewDecoder(bytes.NewReader(data))
	return nil
}

// Decode ...
func (d *JSONReplyDecoder) Decode() (*Reply, error) {
	var c Reply
	err := d.decoder.Decode(&c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ProtobufReplyDecoder ...
type ProtobufReplyDecoder struct {
	data   []byte
	offset int
}

// NewProtobufReplyDecoder ...
func NewProtobufReplyDecoder(data []byte) *ProtobufReplyDecoder {
	return &ProtobufReplyDecoder{
		data: data,
	}
}

// Reset ...
func (d *ProtobufReplyDecoder) Reset(data []byte) error {
	d.data = data
	d.offset = 0
	return nil
}

// Decode ...
func (d *ProtobufReplyDecoder) Decode() (*Reply, error) {
	if d.offset < len(d.data) {
		var c Reply
		l, n := binary.Uvarint(d.data[d.offset:])
		replyBytes := d.data[d.offset+n : d.offset+n+int(l)]
		err := c.Unmarshal(replyBytes)
		if err != nil {
			return nil, err
		}
		d.offset = d.offset + n + int(l)
		return &c, nil
	}
	return nil, io.EOF
}

// ResultDecoder ...
type ResultDecoder interface {
	Decode([]byte, interface{}) error
}

// JSONResultDecoder ...
type JSONResultDecoder struct{}

// NewJSONResultDecoder ...
func NewJSONResultDecoder() *JSONResultDecoder {
	return &JSONResultDecoder{}
}

// Decode ...
func (e *JSONResultDecoder) Decode(data []byte, dest interface{}) error {
	return json.Unmarshal(data, dest)
}

// ProtobufResultDecoder ...
type ProtobufResultDecoder struct{}

// NewProtobufResultDecoder ...
func NewProtobufResultDecoder() *ProtobufResultDecoder {
	return &ProtobufResultDecoder{}
}

// Decode ...
func (e *ProtobufResultDecoder) Decode(data []byte, dest interface{}) error {
	m, ok := dest.(proto.Unmarshaler)
	if !ok {
		return fmt.Errorf("can not unmarshal type from Protobuf")
	}
	return m.Unmarshal(data)
}
