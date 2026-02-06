// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-openapi/jsonreference"
)

// Refable is a struct for things that accept a $ref property
type Refable struct {
	Ref Ref
}

// MarshalJSON marshals the ref to json
func (r Refable) MarshalJSON() ([]byte, error) {
	return r.Ref.MarshalJSON()
}

// UnmarshalJSON unmarshals the ref from json
func (r *Refable) UnmarshalJSON(d []byte) error {
	return json.Unmarshal(d, &r.Ref)
}

// Ref represents a json reference that is potentially resolved
type Ref struct {
	jsonreference.Ref
}

// NewRef creates a new instance of a ref object
// returns an error when the reference uri is an invalid uri
func NewRef(refURI string) (Ref, error) {
	ref, err := jsonreference.New(refURI)
	if err != nil {
		return Ref{}, err
	}

	return Ref{Ref: ref}, nil
}

// MustCreateRef creates a ref object but panics when refURI is invalid.
// Use the NewRef method for a version that returns an error.
func MustCreateRef(refURI string) Ref {
	return Ref{Ref: jsonreference.MustCreateRef(refURI)}
}

// RemoteURI gets the remote uri part of the ref
func (r *Ref) RemoteURI() string {
	if r.String() == "" {
		return ""
	}

	u := *r.GetURL()
	u.Fragment = ""
	return u.String()
}

// IsValidURI returns true when the url the ref points to can be found
func (r *Ref) IsValidURI(basepaths ...string) bool {
	if r.String() == "" {
		return true
	}

	v := r.RemoteURI()
	if v == "" {
		return true
	}

	if r.HasFullURL {
		//nolint:noctx,gosec
		rr, err := http.Get(v)
		if err != nil {
			return false
		}
		defer rr.Body.Close()

		// true if the response is >= 200 and < 300
		return rr.StatusCode/100 == 2 //nolint:mnd
	}

	if !r.HasFileScheme && !r.HasFullFilePath && !r.HasURLPathOnly {
		return false
	}

	// check for local file
	pth := v
	if r.HasURLPathOnly {
		base := "."
		if len(basepaths) > 0 {
			base = filepath.Dir(filepath.Join(basepaths...))
		}
		p, e := filepath.Abs(filepath.ToSlash(filepath.Join(base, pth)))
		if e != nil {
			return false
		}
		pth = p
	}

	fi, err := os.Stat(filepath.ToSlash(pth))
	if err != nil {
		return false
	}

	return !fi.IsDir()
}

// Inherits creates a new reference from a parent and a child
// If the child cannot inherit from the parent, an error is returned
func (r *Ref) Inherits(child Ref) (*Ref, error) {
	ref, err := r.Ref.Inherits(child.Ref)
	if err != nil {
		return nil, err
	}
	return &Ref{Ref: *ref}, nil
}

// MarshalJSON marshals this ref into a JSON object
func (r Ref) MarshalJSON() ([]byte, error) {
	str := r.String()
	if str == "" {
		if r.IsRoot() {
			return []byte(`{"$ref":""}`), nil
		}
		return []byte("{}"), nil
	}
	v := map[string]any{"$ref": str}
	return json.Marshal(v)
}

// UnmarshalJSON unmarshals this ref from a JSON object
func (r *Ref) UnmarshalJSON(d []byte) error {
	var v map[string]any
	if err := json.Unmarshal(d, &v); err != nil {
		return err
	}
	return r.fromMap(v)
}

// GobEncode provides a safe gob encoder for Ref
func (r Ref) GobEncode() ([]byte, error) {
	var b bytes.Buffer
	raw, err := r.MarshalJSON()
	if err != nil {
		return nil, err
	}
	err = gob.NewEncoder(&b).Encode(raw)
	return b.Bytes(), err
}

// GobDecode provides a safe gob decoder for Ref
func (r *Ref) GobDecode(b []byte) error {
	var raw []byte
	buf := bytes.NewBuffer(b)
	err := gob.NewDecoder(buf).Decode(&raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, r)
}

func (r *Ref) fromMap(v map[string]any) error {
	if v == nil {
		return nil
	}

	if vv, ok := v["$ref"]; ok {
		if str, ok := vv.(string); ok {
			ref, err := jsonreference.New(str)
			if err != nil {
				return err
			}
			*r = Ref{Ref: ref}
		}
	}

	return nil
}
