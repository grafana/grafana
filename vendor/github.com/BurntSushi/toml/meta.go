package toml

import (
	"strings"
)

// MetaData allows access to meta information about TOML data that's not
// accessible otherwise.
//
// It allows checking if a key is defined in the TOML data, whether any keys
// were undecoded, and the TOML type of a key.
type MetaData struct {
	context Key // Used only during decoding.

	keyInfo map[string]keyInfo
	mapping map[string]any
	keys    []Key
	decoded map[string]struct{}
	data    []byte // Input file; for errors.
}

// IsDefined reports if the key exists in the TOML data.
//
// The key should be specified hierarchically, for example to access the TOML
// key "a.b.c" you would use IsDefined("a", "b", "c"). Keys are case sensitive.
//
// Returns false for an empty key.
func (md *MetaData) IsDefined(key ...string) bool {
	if len(key) == 0 {
		return false
	}

	var (
		hash      map[string]any
		ok        bool
		hashOrVal any = md.mapping
	)
	for _, k := range key {
		if hash, ok = hashOrVal.(map[string]any); !ok {
			return false
		}
		if hashOrVal, ok = hash[k]; !ok {
			return false
		}
	}
	return true
}

// Type returns a string representation of the type of the key specified.
//
// Type will return the empty string if given an empty key or a key that does
// not exist. Keys are case sensitive.
func (md *MetaData) Type(key ...string) string {
	if ki, ok := md.keyInfo[Key(key).String()]; ok {
		return ki.tomlType.typeString()
	}
	return ""
}

// Keys returns a slice of every key in the TOML data, including key groups.
//
// Each key is itself a slice, where the first element is the top of the
// hierarchy and the last is the most specific. The list will have the same
// order as the keys appeared in the TOML data.
//
// All keys returned are non-empty.
func (md *MetaData) Keys() []Key {
	return md.keys
}

// Undecoded returns all keys that have not been decoded in the order in which
// they appear in the original TOML document.
//
// This includes keys that haven't been decoded because of a [Primitive] value.
// Once the Primitive value is decoded, the keys will be considered decoded.
//
// Also note that decoding into an empty interface will result in no decoding,
// and so no keys will be considered decoded.
//
// In this sense, the Undecoded keys correspond to keys in the TOML document
// that do not have a concrete type in your representation.
func (md *MetaData) Undecoded() []Key {
	undecoded := make([]Key, 0, len(md.keys))
	for _, key := range md.keys {
		if _, ok := md.decoded[key.String()]; !ok {
			undecoded = append(undecoded, key)
		}
	}
	return undecoded
}

// Key represents any TOML key, including key groups. Use [MetaData.Keys] to get
// values of this type.
type Key []string

func (k Key) String() string {
	// This is called quite often, so it's a bit funky to make it faster.
	var b strings.Builder
	b.Grow(len(k) * 25)
outer:
	for i, kk := range k {
		if i > 0 {
			b.WriteByte('.')
		}
		if kk == "" {
			b.WriteString(`""`)
		} else {
			for _, r := range kk {
				// "Inline" isBareKeyChar
				if !((r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-') {
					b.WriteByte('"')
					b.WriteString(dblQuotedReplacer.Replace(kk))
					b.WriteByte('"')
					continue outer
				}
			}
			b.WriteString(kk)
		}
	}
	return b.String()
}

func (k Key) maybeQuoted(i int) string {
	if k[i] == "" {
		return `""`
	}
	for _, r := range k[i] {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			continue
		}
		return `"` + dblQuotedReplacer.Replace(k[i]) + `"`
	}
	return k[i]
}

// Like append(), but only increase the cap by 1.
func (k Key) add(piece string) Key {
	newKey := make(Key, len(k)+1)
	copy(newKey, k)
	newKey[len(k)] = piece
	return newKey
}

func (k Key) parent() Key  { return k[:len(k)-1] } // all except the last piece.
func (k Key) last() string { return k[len(k)-1] }  // last piece of this key.
