package protocol

import (
	"fmt"
)

// ApplyDelta applies delta changes to a base object's data to reconstruct the full object.
// This function processes delta instructions sequentially to produce the target object.
//
// The delta format consists of two types of instructions:
//  1. Copy from source: Copy a range of bytes from the base data
//  2. Insert new data: Insert bytes directly from the delta
//
// Parameters:
//   - baseData: The source/base object data to apply the delta to
//   - delta: The Delta object containing the changes to apply
//
// Returns:
//   - []byte: The reconstructed target object data
//   - error: Error if delta application fails (e.g., base size mismatch, invalid offsets)
//
// For more details about Git's delta format, see:
// https://git-scm.com/docs/pack-format#_deltified_representation
func ApplyDelta(baseData []byte, delta *Delta) ([]byte, error) {
	// Validate base data size matches delta's expectation
	if uint64(len(baseData)) != delta.ExpectedSourceLength {
		return nil, fmt.Errorf("base data size mismatch: got %d bytes, delta expects %d bytes",
			len(baseData), delta.ExpectedSourceLength)
	}

	// Pre-allocate result buffer with estimated size
	// This is an optimization to reduce allocations during delta application
	var result []byte
	estimatedSize := delta.ExpectedSourceLength
	if len(delta.Changes) > 0 {
		// Rough estimate: add space for new data in delta
		estimatedSize += uint64(len(delta.Changes) * 64) // Conservative estimate
	}
	result = make([]byte, 0, estimatedSize)

	// Apply each delta change sequentially
	for i, change := range delta.Changes {
		if change.DeltaData != nil {
			// Instruction type 1: Insert new data from the delta
			result = append(result, change.DeltaData...)
		} else {
			// Instruction type 2: Copy data from the base object
			// Validate that the copy operation is within bounds
			if change.SourceOffset+change.Length > uint64(len(baseData)) {
				return nil, fmt.Errorf("delta change %d: copy operation out of bounds (offset=%d, length=%d, base_size=%d)",
					i, change.SourceOffset, change.Length, len(baseData))
			}

			if change.Length == 0 {
				return nil, fmt.Errorf("delta change %d: invalid zero-length copy operation", i)
			}

			// Copy the specified range from base data
			copyData := baseData[change.SourceOffset : change.SourceOffset+change.Length]
			result = append(result, copyData...)
		}
	}

	return result, nil
}
