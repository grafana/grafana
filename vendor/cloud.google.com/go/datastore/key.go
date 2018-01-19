// Copyright 2014 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package datastore

import (
	"bytes"
	"encoding/base64"
	"encoding/gob"
	"errors"
	"strconv"
	"strings"

	"github.com/golang/protobuf/proto"
	"golang.org/x/net/context"
	pb "google.golang.org/genproto/googleapis/datastore/v1"
)

// Key represents the datastore key for a stored entity.
type Key struct {
	// Kind cannot be empty.
	Kind string
	// Either ID or Name must be zero for the Key to be valid.
	// If both are zero, the Key is incomplete.
	ID   int64
	Name string
	// Parent must either be a complete Key or nil.
	Parent *Key

	// Namespace provides the ability to partition your data for multiple
	// tenants. In most cases, it is not necessary to specify a namespace.
	// See docs on datastore multitenancy for details:
	// https://cloud.google.com/datastore/docs/concepts/multitenancy
	Namespace string
}

// Incomplete reports whether the key does not refer to a stored entity.
func (k *Key) Incomplete() bool {
	return k.Name == "" && k.ID == 0
}

// valid returns whether the key is valid.
func (k *Key) valid() bool {
	if k == nil {
		return false
	}
	for ; k != nil; k = k.Parent {
		if k.Kind == "" {
			return false
		}
		if k.Name != "" && k.ID != 0 {
			return false
		}
		if k.Parent != nil {
			if k.Parent.Incomplete() {
				return false
			}
			if k.Parent.Namespace != k.Namespace {
				return false
			}
		}
	}
	return true
}

// Equal reports whether two keys are equal. Two keys are equal if they are
// both nil, or if their kinds, IDs, names, namespaces and parents are equal.
func (k *Key) Equal(o *Key) bool {
	for {
		if k == nil || o == nil {
			return k == o // if either is nil, both must be nil
		}
		if k.Namespace != o.Namespace || k.Name != o.Name || k.ID != o.ID || k.Kind != o.Kind {
			return false
		}
		if k.Parent == nil && o.Parent == nil {
			return true
		}
		k = k.Parent
		o = o.Parent
	}
}

// marshal marshals the key's string representation to the buffer.
func (k *Key) marshal(b *bytes.Buffer) {
	if k.Parent != nil {
		k.Parent.marshal(b)
	}
	b.WriteByte('/')
	b.WriteString(k.Kind)
	b.WriteByte(',')
	if k.Name != "" {
		b.WriteString(k.Name)
	} else {
		b.WriteString(strconv.FormatInt(k.ID, 10))
	}
}

// String returns a string representation of the key.
func (k *Key) String() string {
	if k == nil {
		return ""
	}
	b := bytes.NewBuffer(make([]byte, 0, 512))
	k.marshal(b)
	return b.String()
}

// Note: Fields not renamed compared to appengine gobKey struct
// This ensures gobs created by appengine can be read here, and vice/versa
type gobKey struct {
	Kind      string
	StringID  string
	IntID     int64
	Parent    *gobKey
	AppID     string
	Namespace string
}

func keyToGobKey(k *Key) *gobKey {
	if k == nil {
		return nil
	}
	return &gobKey{
		Kind:      k.Kind,
		StringID:  k.Name,
		IntID:     k.ID,
		Parent:    keyToGobKey(k.Parent),
		Namespace: k.Namespace,
	}
}

func gobKeyToKey(gk *gobKey) *Key {
	if gk == nil {
		return nil
	}
	return &Key{
		Kind:      gk.Kind,
		Name:      gk.StringID,
		ID:        gk.IntID,
		Parent:    gobKeyToKey(gk.Parent),
		Namespace: gk.Namespace,
	}
}

// GobEncode marshals the key into a sequence of bytes
// using an encoding/gob.Encoder.
func (k *Key) GobEncode() ([]byte, error) {
	buf := new(bytes.Buffer)
	if err := gob.NewEncoder(buf).Encode(keyToGobKey(k)); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// GobDecode unmarshals a sequence of bytes using an encoding/gob.Decoder.
func (k *Key) GobDecode(buf []byte) error {
	gk := new(gobKey)
	if err := gob.NewDecoder(bytes.NewBuffer(buf)).Decode(gk); err != nil {
		return err
	}
	*k = *gobKeyToKey(gk)
	return nil
}

// MarshalJSON marshals the key into JSON.
func (k *Key) MarshalJSON() ([]byte, error) {
	return []byte(`"` + k.Encode() + `"`), nil
}

// UnmarshalJSON unmarshals a key JSON object into a Key.
func (k *Key) UnmarshalJSON(buf []byte) error {
	if len(buf) < 2 || buf[0] != '"' || buf[len(buf)-1] != '"' {
		return errors.New("datastore: bad JSON key")
	}
	k2, err := DecodeKey(string(buf[1 : len(buf)-1]))
	if err != nil {
		return err
	}
	*k = *k2
	return nil
}

// Encode returns an opaque representation of the key
// suitable for use in HTML and URLs.
// This is compatible with the Python and Java runtimes.
func (k *Key) Encode() string {
	pKey := keyToProto(k)

	b, err := proto.Marshal(pKey)
	if err != nil {
		panic(err)
	}

	// Trailing padding is stripped.
	return strings.TrimRight(base64.URLEncoding.EncodeToString(b), "=")
}

// DecodeKey decodes a key from the opaque representation returned by Encode.
func DecodeKey(encoded string) (*Key, error) {
	// Re-add padding.
	if m := len(encoded) % 4; m != 0 {
		encoded += strings.Repeat("=", 4-m)
	}

	b, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	pKey := new(pb.Key)
	if err := proto.Unmarshal(b, pKey); err != nil {
		return nil, err
	}
	return protoToKey(pKey)
}

// AllocateIDs accepts a slice of incomplete keys and returns a
// slice of complete keys that are guaranteed to be valid in the datastore.
func (c *Client) AllocateIDs(ctx context.Context, keys []*Key) ([]*Key, error) {
	if keys == nil {
		return nil, nil
	}

	req := &pb.AllocateIdsRequest{
		ProjectId: c.dataset,
		Keys:      multiKeyToProto(keys),
	}
	resp, err := c.client.AllocateIds(ctx, req)
	if err != nil {
		return nil, err
	}

	return multiProtoToKey(resp.Keys)
}

// IncompleteKey creates a new incomplete key.
// The supplied kind cannot be empty.
// The namespace of the new key is empty.
func IncompleteKey(kind string, parent *Key) *Key {
	return &Key{
		Kind:   kind,
		Parent: parent,
	}
}

// NameKey creates a new key with a name.
// The supplied kind cannot be empty.
// The supplied parent must either be a complete key or nil.
// The namespace of the new key is empty.
func NameKey(kind, name string, parent *Key) *Key {
	return &Key{
		Kind:   kind,
		Name:   name,
		Parent: parent,
	}
}

// IDKey creates a new key with an ID.
// The supplied kind cannot be empty.
// The supplied parent must either be a complete key or nil.
// The namespace of the new key is empty.
func IDKey(kind string, id int64, parent *Key) *Key {
	return &Key{
		Kind:   kind,
		ID:     id,
		Parent: parent,
	}
}
