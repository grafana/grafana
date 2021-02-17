package protocol

import "sync"

// Type determines connection protocol type.
type Type string

const (
	// TypeJSON means JSON protocol - in this case data encoded in
	// JSON-streaming format.
	TypeJSON Type = "json"
	// TypeProtobuf means protobuf protocol - in this case data encoded
	// as length-delimited (varint) protobuf messages.
	TypeProtobuf Type = "protobuf"
)

// GetPushEncoder ...
func GetPushEncoder(protoType Type) PushEncoder {
	if protoType == TypeJSON {
		return NewJSONPushEncoder()
	}
	return NewProtobufPushEncoder()
}

var (
	jsonReplyEncoderPool     sync.Pool
	protobufReplyEncoderPool sync.Pool
)

// GetReplyEncoder ...
func GetReplyEncoder(protoType Type) ReplyEncoder {
	if protoType == TypeJSON {
		e := jsonReplyEncoderPool.Get()
		if e == nil {
			return NewJSONReplyEncoder()
		}
		protoTypeoder := e.(ReplyEncoder)
		protoTypeoder.Reset()
		return protoTypeoder
	}
	e := protobufReplyEncoderPool.Get()
	if e == nil {
		return NewProtobufReplyEncoder()
	}
	protoTypeoder := e.(ReplyEncoder)
	protoTypeoder.Reset()
	return protoTypeoder
}

// PutReplyEncoder ...
func PutReplyEncoder(protoType Type, e ReplyEncoder) {
	if protoType == TypeJSON {
		jsonReplyEncoderPool.Put(e)
		return
	}
	protobufReplyEncoderPool.Put(e)
}

// GetCommandDecoder ...
func GetCommandDecoder(protoType Type, data []byte) CommandDecoder {
	if protoType == TypeJSON {
		return NewJSONCommandDecoder(data)
	}
	return NewProtobufCommandDecoder(data)
}

// PutCommandDecoder ...
func PutCommandDecoder(protoType Type, e CommandDecoder) {
	return
}

// GetResultEncoder ...
func GetResultEncoder(protoType Type) ResultEncoder {
	if protoType == TypeJSON {
		return NewJSONResultEncoder()
	}
	return NewProtobufResultEncoder()
}

// PutResultEncoder ...
func PutResultEncoder(protoType Type, e ReplyEncoder) {
	return
}

// GetParamsDecoder ...
func GetParamsDecoder(protoType Type) ParamsDecoder {
	if protoType == TypeJSON {
		return NewJSONParamsDecoder()
	}
	return NewProtobufParamsDecoder()
}

// PutParamsDecoder ...
func PutParamsDecoder(protoType Type, e ParamsDecoder) {
	return
}
