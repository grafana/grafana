package lz4errors

type Error string

func (e Error) Error() string { return string(e) }

const (
	ErrInvalidSourceShortBuffer      Error = "lz4: invalid source or destination buffer too short"
	ErrInvalidFrame                  Error = "lz4: bad magic number"
	ErrInternalUnhandledState        Error = "lz4: unhandled state"
	ErrInvalidHeaderChecksum         Error = "lz4: invalid header checksum"
	ErrInvalidBlockChecksum          Error = "lz4: invalid block checksum"
	ErrInvalidFrameChecksum          Error = "lz4: invalid frame checksum"
	ErrOptionInvalidCompressionLevel Error = "lz4: invalid compression level"
	ErrOptionClosedOrError           Error = "lz4: cannot apply options on closed or in error object"
	ErrOptionInvalidBlockSize        Error = "lz4: invalid block size"
	ErrOptionNotApplicable           Error = "lz4: option not applicable"
	ErrWriterNotClosed               Error = "lz4: writer not closed"
)
