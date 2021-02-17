package protocol

// EncodingType determines connection payload encoding type.
type EncodingType string

const (
	// EncodingTypeJSON means JSON payload.
	EncodingTypeJSON EncodingType = "json"
	// EncodingTypeBinary means binary payload.
	EncodingTypeBinary EncodingType = "binary"
)
