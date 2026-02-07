package internal

import (
	"github.com/golang/protobuf/proto"
)

// GetUnrecognized fetches the bytes of unrecognized fields for the given message.
func GetUnrecognized(msg proto.Message) []byte {
	return proto.MessageReflect(msg).GetUnknown()
}

// SetUnrecognized adds the given bytes to the unrecognized fields for the given message.
func SetUnrecognized(msg proto.Message, data []byte) {
	refl := proto.MessageReflect(msg)
	existing := refl.GetUnknown()
	if len(existing) > 0 {
		data = append(existing, data...)
	}
	refl.SetUnknown(data)
}
