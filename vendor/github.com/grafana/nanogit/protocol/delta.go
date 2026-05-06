package protocol

// FileStatus represents the status of a file in a commit
// Git file status codes are documented in the Git documentation:
// https://git-scm.com/docs/git-status#_short_format
// https://git-scm.com/docs/git-diff#_combined_diff_format
type FileStatus string

// Includes only file statuses we have implemented:
// - "M" (Modified): A file was modified.
// - "A" (Added): A file was added.
// - "D" (Deleted): A file was deleted.
// - "T" (Type Changed): A file's type changed (e.g., from regular file to symlink).
//
// Other Git status codes, such as "R" (Renamed) and "C" (Copied), are not currently supported.
const (
	// FileStatusModified indicates a file was modified
	FileStatusModified FileStatus = "M"
	// FileStatusAdded indicates a file was added
	FileStatusAdded FileStatus = "A"
	// FileStatusDeleted indicates a file was deleted
	FileStatusDeleted FileStatus = "D"
	// FileStatusTypeChanged indicates a file's type changed (e.g., from regular file to symlink)
	FileStatusTypeChanged FileStatus = "T"
)

var (
	errMissingOffsetByte = strError("missing offset byte")
	errMissingSizeByte   = strError("missing size byte")
)

// Delta represents a delta, which is a way to describe the changes to a file between two commits.
//
// A delta is a sequence of instructions that describe how to modify a source file to produce a target file.
// The source file is usually the parent commit, and the target file is the current commit.
//
// Git uses deltas in pack files to efficiently store objects. Instead of storing complete copies
// of files, Git stores the differences between versions. This is particularly useful for large
// files that change little between commits.
//
// For more details about Git's delta format, see:
// https://git-scm.com/docs/pack-format#_deltified_representation
// https://git-scm.com/book/en/v2/Git-Internals-Packfiles#_deltified_storage
type Delta struct {
	Parent               string
	ExpectedSourceLength uint64
	// Changes contains all the modifications to do in order.
	//
	// When iterating, this must be done sequentially, in order.
	// No modifications of the source data is necessary.
	// The presence of some fields determines how to act; see the documentation of the struct.
	Changes []DeltaChange
}

// DeltaChange represents a single change to a file.
//
// When iterating, this must be done sequentially, in order.
// No modifications of the source data is necessary.
// The presence of some fields determines how to act; see the documentation of the struct.
type DeltaChange struct {
	// If we should add data from the delta, DeltaData contains the data to add. In this case, ignore the Length & SourceOffset fields.
	DeltaData []byte

	// If we should copy from source (DeltaData == nil), SourceOffset is the starting position in the source, and Length is how much data is to be added.
	Length       uint64
	SourceOffset uint64
}

// parseDelta parses a delta payload into a Delta struct.
//
// The delta format consists of:
// 1. A header containing the source and target sizes
// 2. A sequence of instructions, each starting with a command byte
//
// The command byte determines the type of instruction:
// - If the high bit is 0: Add new data from the delta
// - If the high bit is 1: Copy data from the source
//
// For more details about the delta format, see:
// https://git-scm.com/docs/pack-format#_deltified_representation
// FIXME: This logic is pretty hard to follow and test. So it's missing coverage for now
// Review it once we have some more integration testing so that we don't break things unintentionally.
func parseDelta(parent string, payload []byte) (*Delta, error) {
	delta := &Delta{Parent: parent}

	const minDeltaSize = 4
	if len(payload) < minDeltaSize {
		return nil, strError("payload too short")
	}
	delta.ExpectedSourceLength, payload = deltaHeaderSize(payload)
	deltaSize, payload := deltaHeaderSize(payload)
	originalDeltaSize := deltaSize

	for deltaSize > 0 && deltaSize <= originalDeltaSize {
		if len(payload) == 0 {
			return nil, strError("missing cmd byte")
		}

		cmd := payload[0]
		payload = payload[1:]

		change, newPayload, consumedSize, err := parseDeltaCommand(cmd, payload, delta.ExpectedSourceLength, originalDeltaSize)
		if err != nil {
			return nil, err
		}

		if consumedSize == 0 {
			break
		}

		delta.Changes = append(delta.Changes, change)
		deltaSize -= consumedSize
		payload = newPayload
	}

	return delta, nil
}

// parseDeltaCommand parses a single delta command and returns the resulting change,
// remaining payload, consumed size, and any error.
func parseDeltaCommand(cmd byte, payload []byte, expectedSourceLength, originalDeltaSize uint64) (DeltaChange, []byte, uint64, error) {
	if cmd&0x80 != 0 {
		return parseCopyCommand(cmd, payload, expectedSourceLength, originalDeltaSize)
	} else if cmd != 0 {
		return parseAddCommand(cmd, payload, originalDeltaSize)
	} else {
		return DeltaChange{}, payload, 0, strError("payload included a cmd 0x0 (reserved) instruction")
	}
}

// parseCopyCommand parses a copy data instruction from delta command
func parseCopyCommand(cmd byte, payload []byte, expectedSourceLength, originalDeltaSize uint64) (DeltaChange, []byte, uint64, error) {
	offset, newPayload, err := parseOffset(cmd, payload)
	if err != nil {
		return DeltaChange{}, payload, 0, err
	}

	size, finalPayload, err := parseSize(cmd, newPayload)
	if err != nil {
		return DeltaChange{}, payload, 0, err
	}

	if size == 0 {
		size = 0x10000
	}

	if size > originalDeltaSize || offset+size > expectedSourceLength || offset+size < offset {
		return DeltaChange{}, payload, 0, nil
	}

	change := DeltaChange{
		SourceOffset: offset,
		Length:       size,
	}

	return change, finalPayload, size, nil
}

// parseAddCommand parses an add data instruction from delta command
func parseAddCommand(cmd byte, payload []byte, originalDeltaSize uint64) (DeltaChange, []byte, uint64, error) {
	if uint64(cmd) > originalDeltaSize {
		return DeltaChange{}, payload, 0, nil
	}
	if len(payload) < int(cmd) {
		return DeltaChange{}, payload, 0, strError("missing data bytes")
	}

	change := DeltaChange{
		DeltaData: payload[:cmd],
	}

	return change, payload[cmd:], uint64(cmd), nil
}

// parseOffset extracts offset value from copy command
func parseOffset(cmd byte, payload []byte) (uint64, []byte, error) {
	var offset uint64

	if (cmd & 0b1) != 0 {
		if len(payload) == 0 {
			return 0, payload, errMissingOffsetByte
		}
		offset |= uint64(payload[0])
		payload = payload[1:]
	}
	if (cmd & 0b10) != 0 {
		if len(payload) == 0 {
			return 0, payload, errMissingOffsetByte
		}
		offset |= uint64(payload[0]) << 8
		payload = payload[1:]
	}
	if (cmd & 0b100) != 0 {
		if len(payload) == 0 {
			return 0, payload, errMissingOffsetByte
		}
		offset |= uint64(payload[0]) << 16
		payload = payload[1:]
	}
	if (cmd & 0b1000) != 0 {
		if len(payload) == 0 {
			return 0, payload, errMissingOffsetByte
		}
		offset |= uint64(payload[0]) << 24
		payload = payload[1:]
	}

	return offset, payload, nil
}

// parseSize extracts size value from copy command
func parseSize(cmd byte, payload []byte) (uint64, []byte, error) {
	var size uint64

	if (cmd & 0b10000) != 0 {
		if len(payload) == 0 {
			return 0, payload, errMissingSizeByte
		}
		size |= uint64(payload[0])
		payload = payload[1:]
	}
	if (cmd & 0b100000) != 0 {
		if len(payload) == 0 {
			return 0, payload, errMissingSizeByte
		}
		size |= uint64(payload[0]) << 8
		payload = payload[1:]
	}
	if (cmd & 0b1000000) != 0 {
		if len(payload) == 0 {
			return 0, payload, errMissingSizeByte
		}
		size |= uint64(payload[0]) << 16
		payload = payload[1:]
	}

	return size, payload, nil
}

// deltaHeaderSize parses the header of a delta.
// It returns the size of the delta and the remaining payload.
//
// The header is a sequence of 7-bit integers, terminated by a byte with the most significant bit set.
// The first byte has the least significant 7 bits set.
//
// For more details about the delta header format, see:
// https://git-scm.com/docs/pack-format#_deltified_representation
// FIXME: This logic is pretty hard to follow and test. So it's missing coverage for now
// Review it once we have some more integration testing so that we don't break things unintentionally.
func deltaHeaderSize(b []byte) (uint64, []byte) {
	// TODO: This is a bit of a hack. We should probably have a better way to handle this.
	if len(b) == 0 {
		return 0, b
	}

	var size, j uint64
	var cmd byte
	for {
		cmd = b[j]
		size |= (uint64(cmd) & 0x7f) << (j * 7)
		j++
		if uint64(cmd)&0xb80 == 0 || j == uint64(len(b)) {
			break
		}
	}
	return size, b[j:]
}
