//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package exported

import (
	"bytes"
	"encoding/binary"
	"hash/crc64"
	"io"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
)

// TransferValidationType abstracts the various mechanisms used to verify a transfer.
type TransferValidationType interface {
	Apply(io.ReadSeekCloser, generated.TransactionalContentSetter) (io.ReadSeekCloser, error)
	notPubliclyImplementable()
}

// TransferValidationTypeCRC64 is a TransferValidationType used to provide a precomputed CRC64.
type TransferValidationTypeCRC64 uint64

func (c TransferValidationTypeCRC64) Apply(rsc io.ReadSeekCloser, cfg generated.TransactionalContentSetter) (io.ReadSeekCloser, error) {
	buf := make([]byte, 8)
	binary.LittleEndian.PutUint64(buf, uint64(c))
	cfg.SetCRC64(buf)
	return rsc, nil
}

func (TransferValidationTypeCRC64) notPubliclyImplementable() {}

// TransferValidationTypeComputeCRC64 is a TransferValidationType that indicates a CRC64 should be computed during transfer.
func TransferValidationTypeComputeCRC64() TransferValidationType {
	return transferValidationTypeFn(func(rsc io.ReadSeekCloser, cfg generated.TransactionalContentSetter) (io.ReadSeekCloser, error) {
		buf, err := io.ReadAll(rsc)
		if err != nil {
			return nil, err
		}

		crc := crc64.Checksum(buf, shared.CRC64Table)
		return TransferValidationTypeCRC64(crc).Apply(streaming.NopCloser(bytes.NewReader(buf)), cfg)
	})
}

// TransferValidationTypeMD5 is a TransferValidationType used to provide a precomputed MD5.
type TransferValidationTypeMD5 []byte

func (c TransferValidationTypeMD5) Apply(rsc io.ReadSeekCloser, cfg generated.TransactionalContentSetter) (io.ReadSeekCloser, error) {
	cfg.SetMD5(c)
	return rsc, nil
}

func (TransferValidationTypeMD5) notPubliclyImplementable() {}

type transferValidationTypeFn func(io.ReadSeekCloser, generated.TransactionalContentSetter) (io.ReadSeekCloser, error)

func (t transferValidationTypeFn) Apply(rsc io.ReadSeekCloser, cfg generated.TransactionalContentSetter) (io.ReadSeekCloser, error) {
	return t(rsc, cfg)
}

func (transferValidationTypeFn) notPubliclyImplementable() {}
