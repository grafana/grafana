package flatbuffers

// Codec implements gRPC-go Codec which is used to encode and decode messages.
var Codec = "flatbuffers"

type FlatbuffersCodec struct{}

func (FlatbuffersCodec) Marshal(v interface{}) ([]byte, error) {
	return v.(*Builder).FinishedBytes(), nil
}

func (FlatbuffersCodec) Unmarshal(data []byte, v interface{}) error {
	v.(flatbuffersInit).Init(data, GetUOffsetT(data))
	return nil
}

func (FlatbuffersCodec) String() string {
	return Codec
}

type flatbuffersInit interface {
	Init(data []byte, i UOffsetT)
}
