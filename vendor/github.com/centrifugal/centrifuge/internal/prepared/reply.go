package prepared

import (
	"sync"

	"github.com/centrifugal/protocol"
)

// Reply is structure for encoding reply only once.
type Reply struct {
	ProtoType protocol.Type
	Reply     *protocol.Reply
	data      []byte
	once      sync.Once
}

// NewReply initializes Reply.
func NewReply(reply *protocol.Reply, protoType protocol.Type) *Reply {
	return &Reply{
		Reply:     reply,
		ProtoType: protoType,
	}
}

// Data returns data associated with reply which is only calculated once.
func (r *Reply) Data() []byte {
	r.once.Do(func() {
		encoder := protocol.GetReplyEncoder(r.ProtoType)
		_ = encoder.Encode(r.Reply)
		data := encoder.Finish()
		protocol.PutReplyEncoder(r.ProtoType, encoder)
		r.data = data
	})
	return r.data
}
