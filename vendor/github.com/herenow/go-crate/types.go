package crate

// Crate column types id.
// As listed in the documentation, see: https://crate.io/docs/stable/sql/rest.html#column-types
const (
	typeNull         = 0
	typeNotSupported = 1
	typeByte         = 2
	typeBoolean      = 3
	typeString       = 4
	typeIp           = 5
	typeDouble       = 6
	typeFloat        = 7
	typeShort        = 8
	typeInteger      = 9
	typeLong         = 10
	typeTimestamp    = 11
	typeObject       = 12
	typeGeoPoint     = 13
	typeArray        = 100
	typeSet          = 101
)
