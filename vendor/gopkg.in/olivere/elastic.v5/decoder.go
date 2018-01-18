// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
)

// Decoder is used to decode responses from Elasticsearch.
// Users of elastic can implement their own marshaler for advanced purposes
// and set them per Client (see SetDecoder). If none is specified,
// DefaultDecoder is used.
type Decoder interface {
	Decode(data []byte, v interface{}) error
}

// DefaultDecoder uses json.Unmarshal from the Go standard library
// to decode JSON data.
type DefaultDecoder struct{}

// Decode decodes with json.Unmarshal from the Go standard library.
func (u *DefaultDecoder) Decode(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
