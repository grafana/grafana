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
	"fmt"
	"io"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
)

// FileDecryptor is an interface used by the filereader for decrypting an
// entire parquet file as we go, usually constructed from the DecryptionProperties
type FileDecryptor interface {
	// Returns the key for decrypting the footer if provided
	GetFooterKey() string
	// Provides the file level AAD security bytes
	FileAad() string
	// return which algorithm this decryptor was constructed for
	Algorithm() parquet.Cipher
	// return the FileDecryptionProperties that were used for this decryptor
	Properties() *parquet.FileDecryptionProperties
	// Clear out the decryption keys, this is automatically called after every
	// successfully decrypted file to ensure that keys aren't kept around.
	WipeOutDecryptionKeys()
	// GetFooterDecryptor returns a Decryptor interface for use to decrypt the footer
	// of a parquet file.
	GetFooterDecryptor() Decryptor
	// GetFooterDecryptorForColumnMeta returns a Decryptor interface for Column Metadata
	// in the file footer using the AAD bytes provided.
	GetFooterDecryptorForColumnMeta(aad string) Decryptor
	// GetFooterDecryptorForColumnData returns the decryptor that can be used for decrypting
	// actual column data footer bytes, not column metadata.
	GetFooterDecryptorForColumnData(aad string) Decryptor
	// GetColumnMetaDecryptor returns a decryptor for the requested column path, key and AAD bytes
	// but only for decrypting the row group level metadata
	GetColumnMetaDecryptor(columnPath, columnKeyMetadata, aad string) Decryptor
	// GetColumnDataDecryptor returns a decryptor for the requested column path, key, and AAD bytes
	// but only for the rowgroup column data.
	GetColumnDataDecryptor(columnPath, columnKeyMetadata, aad string) Decryptor
}

type fileDecryptor struct {
	// the properties contains the key retriever for us to get keys
	// from the key metadata
	props *parquet.FileDecryptionProperties
	// concatenation of aad_prefix (if exists) and aad_file_unique
	fileAad                 string
	columnDataMap           map[string]Decryptor
	columnMetaDataMap       map[string]Decryptor
	footerMetadataDecryptor Decryptor
	footerDataDecryptor     Decryptor
	alg                     parquet.Cipher
	footerKeyMetadata       string
	metaDecryptor           *aesDecryptor
	dataDecryptor           *aesDecryptor
	mem                     memory.Allocator
}

// NewFileDecryptor constructs a decryptor from the provided configuration of properties, cipher and key metadata. Using the provided memory allocator or
// the default allocator if one isn't provided.
func NewFileDecryptor(props *parquet.FileDecryptionProperties, fileAad string, alg parquet.Cipher, keymetadata string, mem memory.Allocator) FileDecryptor {
	if mem == nil {
		mem = memory.DefaultAllocator
	}
	return &fileDecryptor{
		fileAad:           fileAad,
		props:             props,
		alg:               alg,
		footerKeyMetadata: keymetadata,
		mem:               mem,
		columnDataMap:     make(map[string]Decryptor),
		columnMetaDataMap: make(map[string]Decryptor),
	}
}

func (d *fileDecryptor) FileAad() string                               { return d.fileAad }
func (d *fileDecryptor) Properties() *parquet.FileDecryptionProperties { return d.props }
func (d *fileDecryptor) Algorithm() parquet.Cipher                     { return d.alg }
func (d *fileDecryptor) GetFooterKey() string {
	footerKey := d.props.FooterKey()
	if footerKey == "" {
		if d.footerKeyMetadata == "" {
			panic("no footer key or key metadata")
		}
		if d.props.KeyRetriever == nil {
			panic("no footer key or key retriever")
		}
		footerKey = d.props.KeyRetriever.GetKey([]byte(d.footerKeyMetadata))
	}
	if footerKey == "" {
		panic("invalid footer encryption key. Could not parse footer metadata")
	}
	return footerKey
}

func (d *fileDecryptor) GetFooterDecryptor() Decryptor {
	aad := CreateFooterAad(d.fileAad)
	return d.getFooterDecryptor(aad, true)
}

func (d *fileDecryptor) GetFooterDecryptorForColumnMeta(aad string) Decryptor {
	return d.getFooterDecryptor(aad, true)
}

func (d *fileDecryptor) GetFooterDecryptorForColumnData(aad string) Decryptor {
	return d.getFooterDecryptor(aad, false)
}

func (d *fileDecryptor) GetColumnMetaDecryptor(columnPath, columnKeyMetadata, aad string) Decryptor {
	return d.getColumnDecryptor(columnPath, columnKeyMetadata, aad, true)
}

func (d *fileDecryptor) GetColumnDataDecryptor(columnPath, columnKeyMetadata, aad string) Decryptor {
	return d.getColumnDecryptor(columnPath, columnKeyMetadata, aad, false)
}

func (d *fileDecryptor) WipeOutDecryptionKeys() {
	d.props.WipeOutDecryptionKeys()
}

func (d *fileDecryptor) getFooterDecryptor(aad string, metadata bool) Decryptor {
	if metadata {
		if d.footerMetadataDecryptor != nil {
			return d.footerMetadataDecryptor
		}
	} else {
		if d.footerDataDecryptor != nil {
			return d.footerDataDecryptor
		}
	}

	footerKey := d.GetFooterKey()

	// Create both data and metadata decryptors to avoid redundant retrieval of key
	// from the key_retriever.
	aesMetaDecrypt := d.getMetaAesDecryptor()
	aesDataDecrypt := d.getDataAesDecryptor()

	d.footerMetadataDecryptor = &decryptor{
		decryptor: aesMetaDecrypt,
		key:       []byte(footerKey),
		fileAad:   []byte(d.fileAad),
		aad:       []byte(aad),
		mem:       d.mem,
	}
	d.footerDataDecryptor = &decryptor{
		decryptor: aesDataDecrypt,
		key:       []byte(footerKey),
		fileAad:   []byte(d.fileAad),
		aad:       []byte(aad),
		mem:       d.mem,
	}

	if metadata {
		return d.footerMetadataDecryptor
	}
	return d.footerDataDecryptor
}

func (d *fileDecryptor) getColumnDecryptor(columnPath, columnMeta, aad string, metadata bool) Decryptor {
	if metadata {
		if res, ok := d.columnMetaDataMap[columnPath]; ok {
			res.UpdateAad(aad)
			return res
		}
	} else {
		if res, ok := d.columnDataMap[columnPath]; ok {
			res.UpdateAad(aad)
			return res
		}
	}

	columnKey := d.props.ColumnKey(columnPath)
	// No explicit column key given via API. Retrieve via key metadata.
	if columnKey == "" && columnMeta != "" && d.props.KeyRetriever != nil {
		columnKey = d.props.KeyRetriever.GetKey([]byte(columnMeta))
	}
	if columnKey == "" {
		panic("hidden column exception, path=" + columnPath)
	}

	aesDataDecrypt := d.getDataAesDecryptor()
	aesMetaDecrypt := d.getMetaAesDecryptor()

	d.columnDataMap[columnPath] = &decryptor{
		decryptor: aesDataDecrypt,
		key:       []byte(columnKey),
		fileAad:   []byte(d.fileAad),
		aad:       []byte(aad),
		mem:       d.mem,
	}
	d.columnMetaDataMap[columnPath] = &decryptor{
		decryptor: aesMetaDecrypt,
		key:       []byte(columnKey),
		fileAad:   []byte(d.fileAad),
		aad:       []byte(aad),
		mem:       d.mem,
	}

	if metadata {
		return d.columnMetaDataMap[columnPath]
	}
	return d.columnDataMap[columnPath]
}

func (d *fileDecryptor) getMetaAesDecryptor() *aesDecryptor {
	if d.metaDecryptor == nil {
		d.metaDecryptor = newAesDecryptor(d.alg, true)
	}
	return d.metaDecryptor
}

func (d *fileDecryptor) getDataAesDecryptor() *aesDecryptor {
	if d.dataDecryptor == nil {
		d.dataDecryptor = newAesDecryptor(d.alg, false)
	}
	return d.dataDecryptor
}

// Decryptor is the basic interface for any decryptor generated from a FileDecryptor
type Decryptor interface {
	// returns the File Level AAD bytes
	FileAad() string
	// returns the current allocator that was used for any extra allocations of buffers
	Allocator() memory.Allocator
	// returns the CiphertextSizeDelta from the decryptor
	CiphertextSizeDelta() int
	// Decrypt just returns the decrypted plaintext from the src ciphertext
	Decrypt(src []byte) []byte
	// Decrypt just returns the decrypted plaintext from the src ciphertext
	DecryptFrom(r io.Reader) []byte
	// set the AAD bytes of the decryptor to the provided string
	UpdateAad(string)
}

type decryptor struct {
	decryptor *aesDecryptor
	key       []byte
	fileAad   []byte
	aad       []byte
	mem       memory.Allocator
}

func (d *decryptor) Allocator() memory.Allocator { return d.mem }
func (d *decryptor) FileAad() string             { return string(d.fileAad) }
func (d *decryptor) UpdateAad(aad string)        { d.aad = []byte(aad) }
func (d *decryptor) CiphertextSizeDelta() int    { return d.decryptor.CiphertextSizeDelta() }
func (d *decryptor) Decrypt(src []byte) []byte {
	return d.decryptor.Decrypt(src, d.key, d.aad)
}
func (d *decryptor) DecryptFrom(r io.Reader) []byte {
	return d.decryptor.DecryptFrom(r, d.key, d.aad)
}

func getColumnDecryptor(cryptoMetadata *format.ColumnCryptoMetaData, fileDecryptor FileDecryptor, metadata bool) (Decryptor, error) {
	if cryptoMetadata == nil {
		return nil, nil
	}

	if fileDecryptor == nil {
		return nil, fmt.Errorf("%w: row group is noted as encrypted but no file decryptor", arrow.ErrNotFound)
	}

	if cryptoMetadata.IsSetENCRYPTION_WITH_FOOTER_KEY() {
		if metadata {
			return fileDecryptor.GetFooterDecryptorForColumnMeta(fileDecryptor.FileAad()), nil
		}
		return fileDecryptor.GetFooterDecryptorForColumnData(fileDecryptor.FileAad()), nil
	}

	// column is encrypted with its own key
	columnKeyMetadata := cryptoMetadata.ENCRYPTION_WITH_COLUMN_KEY.KeyMetadata
	colPath := parquet.ColumnPath(cryptoMetadata.ENCRYPTION_WITH_COLUMN_KEY.PathInSchema).String()
	return fileDecryptor.GetColumnMetaDecryptor(colPath, string(columnKeyMetadata), ""), nil
}

func GetColumnMetaDecryptor(cryptoMetadata *format.ColumnCryptoMetaData, fileDecryptor FileDecryptor) (Decryptor, error) {
	return getColumnDecryptor(cryptoMetadata, fileDecryptor, true)
}

const NonPageOrdinal int16 = -1

func UpdateDecryptor(decryptor Decryptor, rgOrdinal, colOrdinal int16, moduleType int8) {
	debug.Assert(decryptor.FileAad() != "", "file decryptor has no file aad")
	aad := CreateModuleAad(decryptor.FileAad(), moduleType, rgOrdinal, colOrdinal, NonPageOrdinal)
	decryptor.UpdateAad(aad)
}
