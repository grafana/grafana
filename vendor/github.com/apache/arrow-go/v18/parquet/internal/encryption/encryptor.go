// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package encryption

import (
	"io"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
)

// FileEncryptor is the interface for constructing encryptors for the different
// sections of a parquet file.
type FileEncryptor interface {
	// GetFooterEncryptor returns an encryptor for the footer metadata
	GetFooterEncryptor() Encryptor
	// GetFooterSigningEncryptor returns an encryptor for creating the signature
	// for the footer as opposed to encrypting the footer bytes directly.
	GetFooterSigningEncryptor() Encryptor
	// GetColumnMetaEncryptor returns an encryptor for the metadata only of the requested
	// column path string.
	GetColumnMetaEncryptor(columnPath string) Encryptor
	// GetColumnDataEncryptor returns an encryptor for the column data ONLY of
	// the requested column path string.
	GetColumnDataEncryptor(columnPath string) Encryptor
	// WipeOutEncryptionKeys deletes the keys that were used for encryption,
	// called after every successfully encrypted file to ensure against accidental
	// key re-use.
	WipeOutEncryptionKeys()
}

type fileEncryptor struct {
	props                  *parquet.FileEncryptionProperties
	columnDataMap          map[string]Encryptor
	columnMetaDataMap      map[string]Encryptor
	footerSigningEncryptor Encryptor
	footerEncryptor        Encryptor

	// Key must be 16, 24, or 32 bytes in length thus there could be up to
	// three types of meta_encryptors and data_encryptors
	metaEncryptor *aesEncryptor
	dataEncryptor *aesEncryptor

	mem memory.Allocator
}

// NewFileEncryptor returns a new encryptor using the given encryption properties.
//
// Panics if the properties passed have already been used to construct an encryptor
// ie: props.IsUtilized returns true. If mem is nil, will default to memory.DefaultAllocator
func NewFileEncryptor(props *parquet.FileEncryptionProperties, mem memory.Allocator) FileEncryptor {
	if props.IsUtilized() {
		panic("re-using encryption properties for another file")
	}

	props.SetUtilized()
	if mem == nil {
		mem = memory.DefaultAllocator
	}

	return &fileEncryptor{
		props:             props,
		mem:               mem,
		columnDataMap:     make(map[string]Encryptor),
		columnMetaDataMap: make(map[string]Encryptor),
	}
}

func (e *fileEncryptor) WipeOutEncryptionKeys() {
	e.props.WipeOutEncryptionKeys()
}

func (e *fileEncryptor) GetFooterEncryptor() Encryptor {
	if e.footerEncryptor == nil {
		alg := e.props.Algorithm().Algo
		footerAad := CreateFooterAad(e.props.FileAad())
		footerKey := e.props.FooterKey()
		enc := e.getMetaAesEncryptor(alg)
		e.footerEncryptor = &encryptor{
			aesEncryptor: enc,
			key:          []byte(footerKey),
			fileAad:      e.props.FileAad(),
			aad:          footerAad,
			mem:          e.mem,
		}
	}
	return e.footerEncryptor
}

func (e *fileEncryptor) GetFooterSigningEncryptor() Encryptor {
	if e.footerSigningEncryptor == nil {
		alg := e.props.Algorithm().Algo
		footerAad := CreateFooterAad(e.props.FileAad())
		footerKey := e.props.FooterKey()
		enc := e.getMetaAesEncryptor(alg)
		e.footerSigningEncryptor = &encryptor{
			aesEncryptor: enc,
			key:          []byte(footerKey),
			fileAad:      e.props.FileAad(),
			aad:          footerAad,
			mem:          e.mem,
		}
	}
	return e.footerSigningEncryptor
}

func (e *fileEncryptor) getMetaAesEncryptor(alg parquet.Cipher) *aesEncryptor {
	if e.metaEncryptor == nil {
		e.metaEncryptor = NewAesEncryptor(alg, true)
	}
	return e.metaEncryptor
}

func (e *fileEncryptor) getDataAesEncryptor(alg parquet.Cipher) *aesEncryptor {
	if e.dataEncryptor == nil {
		e.dataEncryptor = NewAesEncryptor(alg, false)
	}
	return e.dataEncryptor
}

func (e *fileEncryptor) GetColumnMetaEncryptor(columnPath string) Encryptor {
	return e.getColumnEncryptor(columnPath, true)
}

func (e *fileEncryptor) GetColumnDataEncryptor(columnPath string) Encryptor {
	return e.getColumnEncryptor(columnPath, false)
}

func (e *fileEncryptor) getColumnEncryptor(columnPath string, metadata bool) Encryptor {
	if metadata {
		if enc, ok := e.columnMetaDataMap[columnPath]; ok {
			return enc
		}
	} else {
		if enc, ok := e.columnDataMap[columnPath]; ok {
			return enc
		}
	}

	columnProp := e.props.ColumnEncryptionProperties(columnPath)
	if columnProp == nil {
		return nil
	}

	var key string
	if columnProp.IsEncryptedWithFooterKey() {
		key = e.props.FooterKey()
	} else {
		key = columnProp.Key()
	}

	alg := e.props.Algorithm().Algo
	var enc *aesEncryptor
	if metadata {
		enc = e.getMetaAesEncryptor(alg)
	} else {
		enc = e.getDataAesEncryptor(alg)
	}

	fileAad := e.props.FileAad()
	ret := &encryptor{
		aesEncryptor: enc,
		key:          []byte(key),
		fileAad:      fileAad,
		aad:          "",
		mem:          e.mem,
	}
	if metadata {
		e.columnMetaDataMap[columnPath] = ret
	} else {
		e.columnDataMap[columnPath] = ret
	}
	return ret
}

// Encryptor is the basic interface for encryptors, for now there's only the single
// aes encryptor implementation, but having it as an interface allows easy addition
// manipulation of encryptor implementations in the future.
type Encryptor interface {
	// FileAad returns the file level AAD bytes for this encryptor
	FileAad() string
	// UpdateAad sets the aad bytes for encryption to the provided string
	UpdateAad(string)
	// Allocator returns the allocator that was used to construct the encryptor
	Allocator() memory.Allocator
	// CiphertextSizeDelta returns the extra bytes that will be added to the ciphertext
	// for a total size of len(plaintext) + CiphertextSizeDelta bytes
	CiphertextSizeDelta() int
	// Encrypt writes the encrypted ciphertext for src to w and returns the total
	// number of bytes written.
	Encrypt(w io.Writer, src []byte) int
	// EncryptColumnMetaData returns true if the column metadata should be encrypted based on the
	// column encryption settings and footer encryption setting.
	EncryptColumnMetaData(encryptFooter bool, properties *parquet.ColumnEncryptionProperties) bool
}

type encryptor struct {
	aesEncryptor *aesEncryptor
	key          []byte
	fileAad      string
	aad          string
	mem          memory.Allocator
}

func (e *encryptor) FileAad() string             { return e.fileAad }
func (e *encryptor) UpdateAad(aad string)        { e.aad = aad }
func (e *encryptor) Allocator() memory.Allocator { return e.mem }
func (e *encryptor) CiphertextSizeDelta() int    { return e.aesEncryptor.CiphertextSizeDelta() }

func (e *encryptor) EncryptColumnMetaData(encryptFooter bool, properties *parquet.ColumnEncryptionProperties) bool {
	if properties == nil || !properties.IsEncrypted() {
		return false
	}
	if !encryptFooter {
		return false
	}
	// if not encrypted with footer key then encrypt the metadata
	return !properties.IsEncryptedWithFooterKey()
}

func (e *encryptor) Encrypt(w io.Writer, src []byte) int {
	return e.aesEncryptor.Encrypt(w, src, e.key, []byte(e.aad))
}
