package controlproto

import "github.com/centrifugal/centrifuge/internal/controlpb"

// Decoder ...
type Decoder interface {
	DecodeCommand([]byte) (*controlpb.Command, error)
}

var _ Decoder = (*ProtobufDecoder)(nil)

// ProtobufDecoder ...
type ProtobufDecoder struct{}

// NewProtobufDecoder ...
func NewProtobufDecoder() *ProtobufDecoder {
	return &ProtobufDecoder{}
}

// DecodeCommand ...
func (e *ProtobufDecoder) DecodeCommand(data []byte) (*controlpb.Command, error) {
	var cmd controlpb.Command
	err := cmd.UnmarshalVT(data)
	if err != nil {
		return nil, err
	}
	return &cmd, nil
}
