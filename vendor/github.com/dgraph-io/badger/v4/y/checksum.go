/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package y

import (
	stderrors "errors"
	"hash/crc32"

	"github.com/cespare/xxhash/v2"

	"github.com/dgraph-io/badger/v4/pb"
)

// ErrChecksumMismatch is returned at checksum mismatch.
var ErrChecksumMismatch = stderrors.New("checksum mismatch")

// CalculateChecksum calculates checksum for data using ct checksum type.
func CalculateChecksum(data []byte, ct pb.Checksum_Algorithm) uint64 {
	switch ct {
	case pb.Checksum_CRC32C:
		return uint64(crc32.Checksum(data, CastagnoliCrcTable))
	case pb.Checksum_XXHash64:
		return xxhash.Sum64(data)
	default:
		panic("checksum type not supported")
	}
}

// VerifyChecksum validates the checksum for the data against the given expected checksum.
func VerifyChecksum(data []byte, expected *pb.Checksum) error {
	actual := CalculateChecksum(data, expected.Algo)
	if actual != expected.Sum {
		return Wrapf(ErrChecksumMismatch, "actual: %d, expected: %d", actual, expected.Sum)
	}
	return nil
}
