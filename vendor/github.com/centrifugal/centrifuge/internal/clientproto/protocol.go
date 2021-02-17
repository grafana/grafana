package clientproto

import (
	"github.com/centrifugal/protocol"
)

// NewMessagePush returns initialized async push message.
func NewMessagePush(data protocol.Raw) *protocol.Push {
	return &protocol.Push{
		Type: protocol.PushTypeMessage,
		Data: data,
	}
}

// NewPublicationPush returns initialized async publication message.
func NewPublicationPush(ch string, data protocol.Raw) *protocol.Push {
	return &protocol.Push{
		Type:    protocol.PushTypePublication,
		Channel: ch,
		Data:    data,
	}
}

// NewJoinPush returns initialized async join message.
func NewJoinPush(ch string, data protocol.Raw) *protocol.Push {
	return &protocol.Push{
		Type:    protocol.PushTypeJoin,
		Channel: ch,
		Data:    data,
	}
}

// NewLeavePush returns initialized async leave message.
func NewLeavePush(ch string, data protocol.Raw) *protocol.Push {
	return &protocol.Push{
		Type:    protocol.PushTypeLeave,
		Channel: ch,
		Data:    data,
	}
}

// NewUnsubPush returns initialized async unsubscribe message.
func NewUnsubPush(ch string, data protocol.Raw) *protocol.Push {
	return &protocol.Push{
		Type:    protocol.PushTypeUnsub,
		Channel: ch,
		Data:    data,
	}
}

// NewSubPush returns initialized async subscribe message.
func NewSubPush(ch string, data protocol.Raw) *protocol.Push {
	return &protocol.Push{
		Type:    protocol.PushTypeSub,
		Channel: ch,
		Data:    data,
	}
}
