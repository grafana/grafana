// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package proto // import "go.opentelemetry.io/collector/pdata/internal/proto"

// EncodeVarint encodes the variant at the end of the buffer.
func EncodeVarint(buf []byte, offset int, v uint64) int {
	offset -= Sov(v)
	base := offset
	for v >= 1<<7 {
		//nolint:gosec
		buf[offset] = uint8(v&0x7f | 0x80)
		v >>= 7
		offset++
	}
	buf[offset] = uint8(v)
	return base
}
