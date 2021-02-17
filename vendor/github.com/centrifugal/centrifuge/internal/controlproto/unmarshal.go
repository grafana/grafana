package controlproto

import "github.com/centrifugal/centrifuge/internal/controlpb"

// Decoder ...
type Decoder interface {
	DecodeCommand([]byte) (*controlpb.Command, error)
	DecodeNode([]byte) (*controlpb.Node, error)
	DecodeUnsubscribe([]byte) (*controlpb.Unsubscribe, error)
	DecodeDisconnect([]byte) (*controlpb.Disconnect, error)
}

// ProtobufDecoder ...
type ProtobufDecoder struct {
}

// NewProtobufDecoder ...
func NewProtobufDecoder() *ProtobufDecoder {
	return &ProtobufDecoder{}
}

// DecodeCommand ...
func (e *ProtobufDecoder) DecodeCommand(data []byte) (*controlpb.Command, error) {
	var cmd controlpb.Command
	err := cmd.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &cmd, nil
}

// DecodeNode ...
func (e *ProtobufDecoder) DecodeNode(data []byte) (*controlpb.Node, error) {
	var cmd controlpb.Node
	err := cmd.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &cmd, nil
}

// DecodeUnsubscribe ...
func (e *ProtobufDecoder) DecodeUnsubscribe(data []byte) (*controlpb.Unsubscribe, error) {
	var cmd controlpb.Unsubscribe
	err := cmd.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &cmd, nil
}

// DecodeDisconnect ...
func (e *ProtobufDecoder) DecodeDisconnect(data []byte) (*controlpb.Disconnect, error) {
	var cmd controlpb.Disconnect
	err := cmd.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return &cmd, nil
}
