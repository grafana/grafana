// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package data // import "go.opentelemetry.io/collector/pdata/internal/data"

import (
	"encoding/hex"

	"go.opentelemetry.io/collector/pdata/internal/json"
)

// unmarshalJSON inflates trace id from hex string, possibly enclosed in quotes.
// Called by Protobuf JSON deserialization.
func unmarshalJSON(dst []byte, iter *json.Iterator) {
	src := iter.ReadStringAsSlice()
	if len(src) == 0 {
		return
	}

	if len(dst) != hex.DecodedLen(len(src)) {
		iter.ReportError("ID.UnmarshalJSONIter", "length mismatch")
		return
	}

	_, err := hex.Decode(dst, src)
	if err != nil {
		iter.ReportError("ID.UnmarshalJSONIter", err.Error())
		return
	}
}
