package protocol

import "sync"

// Type determines connection protocol type.
type Type string

const (
	// TypeJSON means JSON protocol.
	TypeJSON Type = "json"
	// TypeProtobuf means Protobuf protocol.
	TypeProtobuf Type = "protobuf"
)

type FrameType uint8

const (
	FrameTypeServerPing FrameType = iota + 1
	FrameTypeClientPong

	FrameTypePushConnect
	FrameTypePushSubscribe
	FrameTypePushPublication
	FrameTypePushJoin
	FrameTypePushLeave
	FrameTypePushUnsubscribe
	FrameTypePushMessage
	FrameTypePushRefresh
	FrameTypePushDisconnect

	FrameTypeConnect
	FrameTypeSubscribe
	FrameTypePublish
	FrameTypeUnsubscribe
	FrameTypeRPC
	FrameTypePresence
	FrameTypePresenceStats
	FrameTypeHistory
	FrameTypeRefresh
	FrameTypeSubRefresh
	FrameTypeSend
)

func (f FrameType) String() string {
	switch f {
	case FrameTypeServerPing:
		return "server_ping"
	case FrameTypeClientPong:
		return "client_pong"

	case FrameTypePushConnect:
		return "push_connect"
	case FrameTypePushSubscribe:
		return "push_subscribe"
	case FrameTypePushPublication:
		return "push_publication"
	case FrameTypePushJoin:
		return "push_join"
	case FrameTypePushLeave:
		return "push_leave"
	case FrameTypePushUnsubscribe:
		return "push_unsubscribe"
	case FrameTypePushMessage:
		return "push_message"
	case FrameTypePushRefresh:
		return "push_refresh"
	case FrameTypePushDisconnect:
		return "push_disconnect"

	case FrameTypeConnect:
		return "connect"
	case FrameTypeSubscribe:
		return "subscribe"
	case FrameTypePublish:
		return "publish"
	case FrameTypeUnsubscribe:
		return "unsubscribe"
	case FrameTypeRPC:
		return "rpc"
	case FrameTypePresence:
		return "presence"
	case FrameTypePresenceStats:
		return "presence_stats"
	case FrameTypeHistory:
		return "history"
	case FrameTypeSubRefresh:
		return "sub_refresh"
	case FrameTypeRefresh:
		return "refresh"
	case FrameTypeSend:
		return "send"

	default:
		return "unknown"
	}
}

var (
	DefaultJsonPushEncoder     = NewJSONPushEncoder()
	DefaultProtobufPushEncoder = NewProtobufPushEncoder()
)

// GetPushEncoder ...
func GetPushEncoder(protoType Type) PushEncoder {
	if protoType == TypeJSON {
		return DefaultJsonPushEncoder
	}
	return DefaultProtobufPushEncoder
}

var (
	DefaultJsonReplyEncoder     = NewJSONReplyEncoder()
	DefaultProtobufReplyEncoder = NewProtobufReplyEncoder()
)

// GetReplyEncoder ...
func GetReplyEncoder(protoType Type) ReplyEncoder {
	if protoType == TypeJSON {
		return DefaultJsonReplyEncoder
	}
	return DefaultProtobufReplyEncoder
}

var (
	jsonDataEncoderPool        sync.Pool
	protobufDataEncoderPool    sync.Pool
	jsonCommandDecoderPool     sync.Pool
	protobufCommandDecoderPool sync.Pool
)

// GetDataEncoder ...
func GetDataEncoder(protoType Type) DataEncoder {
	if protoType == TypeJSON {
		e := jsonDataEncoderPool.Get()
		if e == nil {
			return NewJSONDataEncoder()
		}
		protoEncoder := e.(DataEncoder)
		protoEncoder.Reset()
		return protoEncoder
	}
	e := protobufDataEncoderPool.Get()
	if e == nil {
		return NewProtobufDataEncoder()
	}
	protoEncoder := e.(DataEncoder)
	protoEncoder.Reset()
	return protoEncoder
}

// PutDataEncoder ...
func PutDataEncoder(protoType Type, e DataEncoder) {
	if protoType == TypeJSON {
		jsonDataEncoderPool.Put(e)
		return
	}
	protobufDataEncoderPool.Put(e)
}

// GetCommandDecoder ...
func GetCommandDecoder(protoType Type, data []byte) CommandDecoder {
	if protoType == TypeJSON {
		e := jsonCommandDecoderPool.Get()
		if e == nil {
			return NewJSONCommandDecoder(data)
		}
		commandDecoder := e.(*JSONCommandDecoder)
		_ = commandDecoder.Reset(data)
		return commandDecoder
	}
	e := protobufCommandDecoderPool.Get()
	if e == nil {
		return NewProtobufCommandDecoder(data)
	}
	commandDecoder := e.(*ProtobufCommandDecoder)
	_ = commandDecoder.Reset(data)
	return commandDecoder
}

// PutCommandDecoder ...
func PutCommandDecoder(protoType Type, e CommandDecoder) {
	if protoType == TypeJSON {
		jsonCommandDecoderPool.Put(e)
		return
	}
	protobufCommandDecoderPool.Put(e)
}

// GetResultEncoder ...
func GetResultEncoder(protoType Type) ResultEncoder {
	if protoType == TypeJSON {
		return NewJSONResultEncoder()
	}
	return NewProtobufResultEncoder()
}

// PutResultEncoder ...
func PutResultEncoder(_ Type, _ ReplyEncoder) {}
