package memberlist

import (
	"fmt"
	"unsafe"
)

// EncodedNodeMetadata is the encoded binary representation of node metadata.
// It provides zero-allocation accessor methods to read role and zone.
type EncodedNodeMetadata []byte

const (
	// Minimum metadata size for version 1 (version + role + zone_len with empty zone).
	minMetadataSizeVersion1 = 3
)

// EncodeNodeMetadata encodes node metadata into a compact binary format.
// The encoding is versioned to allow future extensions while maintaining backward compatibility.
//
// We use a custom compact encoding rather than protobuf because memberlist has strict size limits
// for node metadata (typically 512 bytes) and this data is broadcast frequently in alive messages.
//
// Version 1 format:
//   - Byte 0: Version (1 byte)
//   - Byte 1: Role (1 byte): 1=member, 2=bridge
//   - Byte 2: Zone length (1 byte): length of zone string (0-16)
//   - Bytes 3+: Zone string (UTF-8, variable length)
//
// The maximum metadata size is 19 bytes (1 + 1 + 1 + 16).
func EncodeNodeMetadata(role NodeRole, zone string) ([]byte, error) {
	// Validate zone name length.
	zoneLen := len(zone)
	if zoneLen > MaxZoneNameLength {
		return nil, fmt.Errorf("zone name too long: %d bytes (max %d)", zoneLen, MaxZoneNameLength)
	}

	// Allocate buffer: version(1) + role(1) + zone_len(1) + zone(variable).
	buf := make([]byte, 3+zoneLen)

	// Encode version.
	buf[0] = 1

	// Encode role.
	buf[1] = uint8(role)

	// Encode zone length.
	buf[2] = uint8(zoneLen)

	// Encode zone string.
	copy(buf[3:], zone)

	return buf, nil
}

// Role returns the node role with zero allocations.
// Returns NodeRoleMember if the metadata is invalid.
func (e EncodedNodeMetadata) Role() NodeRole {
	if len(e) < minMetadataSizeVersion1 || e[0] != 1 {
		return NodeRoleMember
	}
	return NodeRole(e[1])
}

// Zone returns the zone name as a string with zero allocations.
// Returns empty string if the metadata is invalid.
// The returned string shares the underlying byte slice, so it's valid
// as long as the EncodedNodeMetadata is not modified.
func (e EncodedNodeMetadata) Zone() string {
	if len(e) < minMetadataSizeVersion1 || e[0] != 1 {
		return ""
	}
	zoneLen := int(e[2])
	if len(e) < 3+zoneLen {
		return ""
	}
	if zoneLen == 0 {
		return ""
	}
	// Zero-allocation conversion from []byte to string.
	// Safe because we're not modifying the underlying data.
	return unsafe.String(&e[3], zoneLen)
}
