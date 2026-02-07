// Package object defines the types of objects that can be stored in a Git repository.
//
// Git stores all content as objects in its object database. Each object has a type
// that determines how Git interprets its contents. The object types are:
//
//   - Commit: A snapshot of the repository at a point in time, containing metadata
//     about the commit (author, committer, message) and references to tree and parent
//     objects.
//   - Tree: A directory listing, containing references to blobs and other trees.
//   - Blob: A file's contents.
//   - Tag: A reference to a specific object, usually a commit, with additional metadata.
//
// Additionally, Git uses two special object types for pack files:
//   - OfsDelta: A delta object that references its base by offset within the pack.
//   - RefDelta: A delta object that references its base by its object ID.
//
// For more details about Git's object types and their formats, see:
// https://git-scm.com/book/en/v2/Git-Internals-Git-Objects
// https://git-scm.com/docs/pack-format#_object_types
package protocol

import (
	"crypto"
	"errors"
	"fmt"
	"strconv"

	// Linking the algorithms Git supports into the binary.
	// Their init functions register the hash in the `crypto` package.

	// Git still uses sha1 for the most part: https://git-scm.com/docs/hash-function-transition
	//nolint:gosec
	_ "crypto/sha1"
	_ "crypto/sha256"

	"github.com/grafana/nanogit/protocol/hash"
)

// ObjectType represents a Git object type. The values are chosen to match Git's internal
// representation in pack files, where the type is stored as a 3-bit value.
type ObjectType uint8

// The object types. The values are chosen to match Git's internal representation
// in pack files, where the type is stored as a 3-bit value. Type 5 is reserved
// for future use, and 0 is invalid.
const (
	ObjectTypeInvalid  ObjectType = 0 // 0b000 - Invalid type
	ObjectTypeCommit   ObjectType = 1 // 0b001 - Commit object
	ObjectTypeTree     ObjectType = 2 // 0b010 - Tree object
	ObjectTypeBlob     ObjectType = 3 // 0b011 - Blob object
	ObjectTypeTag      ObjectType = 4 // 0b100 - Tag object
	ObjectTypeReserved ObjectType = 5 // 0b101 - Reserved for future use
	ObjectTypeOfsDelta ObjectType = 6 // 0b110 - Offset delta in pack file
	ObjectTypeRefDelta ObjectType = 7 // 0b111 - Reference delta in pack file
)

// String returns the string representation of the object type.
// This is used for debugging and error messages.
func (t ObjectType) String() string {
	switch t {
	case ObjectTypeInvalid:
		return "OBJ_INVALID"
	case ObjectTypeCommit:
		return "OBJ_COMMIT"
	case ObjectTypeTree:
		return "OBJ_TREE"
	case ObjectTypeBlob:
		return "OBJ_BLOB"
	case ObjectTypeTag:
		return "OBJ_TAG"
	case ObjectTypeReserved:
		return "OBJ_RESERVED"
	case ObjectTypeOfsDelta:
		return "OBJ_OFS_DELTA"
	case ObjectTypeRefDelta:
		return "OBJ_REF_DELTA"
	default:
		return fmt.Sprintf("object.Type(%d)", uint8(t))
	}
}

// Bytes returns the byte representation of the object type as used in Git's
// object format. This is the string that appears in the object header,
// e.g., "commit", "tree", "blob", etc.
//
// For more details about Git's object format, see:
// https://git-scm.com/book/en/v2/Git-Internals-Git-Objects#_object_storage
func (t ObjectType) Bytes() []byte {
	switch t {
	case ObjectTypeCommit:
		return []byte("commit")
	case ObjectTypeTree:
		return []byte("tree")
	case ObjectTypeBlob:
		return []byte("blob")
	case ObjectTypeTag:
		return []byte("tag")
	case ObjectTypeOfsDelta:
		return []byte("ofs-delta")
	case ObjectTypeRefDelta:
		return []byte("ref-delta")
	case ObjectTypeInvalid, ObjectTypeReserved:
		fallthrough
	default:
		return []byte("unknown")
	}
}

// ErrUnlinkedAlgorithm is returned when trying to use a hash algorithm that is not
// linked into the binary (e.g., MD5).
var ErrUnlinkedAlgorithm = errors.New("the algorithm is not linked into the binary")

// Object computes the hash of a Git object. Git objects are stored with a header followed by the content.
// The header format is: "<type> <size>\0" where:
//   - <type> is the object type (commit, tree, blob, or tag)
//   - <size> is the size of the content in bytes
//   - \0 is a null byte
//
// For example, a blob containing "test" would be stored as:
//
//	"blob 4\0test"
//
// The hash is computed over both the header and the content. This ensures that:
//  1. Objects of different types with the same content have different hashes
//  2. The size is verified when the object is read
//  3. The object type is verified when the object is read
//
// For more details about Git's object format and internals, see:
// https://git-scm.com/book/en/v2/Git-Internals-Git-Objects
//
// By default, Git uses SHA-1 for object hashes, but is transitioning to SHA-256:
// https://git-scm.com/docs/hash-function-transition
func Object(algo crypto.Hash, t ObjectType, data []byte) (hash.Hash, error) {
	h, err := NewHasher(algo, t, int64(len(data)))
	if err != nil {
		return hash.Zero, err
	}

	if _, err = h.Write(data); err != nil {
		return hash.Zero, err
	}

	sum := h.Sum(nil)
	if len(sum) != 20 {
		return hash.Zero, fmt.Errorf("expected 20-byte hash, got %d bytes", len(sum))
	}

	var result hash.Hash
	copy(result[:], sum)
	return result, nil
}

// NewHasher creates a new hasher for a Git object. It writes the object header
// to the hash before returning, so the caller only needs to write the object content.
//
// The header consists of:
//  1. The object type as a string (e.g., "commit", "tree", "blob", "tag")
//  2. A space character
//  3. The size of the content as a decimal string
//  4. A null byte
//
// For example, for a blob of size 42, the header would be:
//
//	"blob 42\0"
//
// This matches Git's internal object format, ensuring hash compatibility with Git.
// For more details about Git's object format and internals, see:
// https://git-scm.com/book/en/v2/Git-Internals-Git-Objects
func NewHasher(algo crypto.Hash, t ObjectType, size int64) (hash.Hasher, error) {
	if !algo.Available() { // Avoid a panic
		return hash.Hasher{}, ErrUnlinkedAlgorithm
	}
	h := hash.Hasher{Hash: algo.New()}

	chunks := [][]byte{
		t.Bytes(),                           // object type
		[]byte(" "),                         // space
		[]byte(strconv.FormatInt(size, 10)), // size
		{0},                                 // null byte
	}

	for _, chunk := range chunks {
		if _, err := h.Write(chunk); err != nil {
			return hash.Hasher{}, err
		}
	}

	return h, nil
}
