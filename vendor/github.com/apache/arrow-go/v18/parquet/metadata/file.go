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

package metadata

import (
	"bytes"
	"context"
	"crypto/subtle"
	"fmt"
	"io"
	"reflect"
	"unicode/utf8"

	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/compress"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/thrift"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"golang.org/x/xerrors"
)

// DefaultCompressionType is used unless a different compression is specified
// in the properties
var DefaultCompressionType = compress.Codecs.Uncompressed

// FileMetaDataBuilder is a proxy for more easily constructing file metadata
// particularly used when writing a file out.
type FileMetaDataBuilder struct {
	metadata       *format.FileMetaData
	props          *parquet.WriterProperties
	schema         *schema.Schema
	rowGroups      []*format.RowGroup
	currentRgBldr  *RowGroupMetaDataBuilder
	kvmeta         KeyValueMetadata
	cryptoMetadata *format.FileCryptoMetaData
	fileEncryptor  encryption.FileEncryptor
}

// NewFileMetadataBuilder will use the default writer properties if nil is passed for
// the writer properties and nil is allowable for the key value metadata.
func NewFileMetadataBuilder(schema *schema.Schema, props *parquet.WriterProperties, kvmeta KeyValueMetadata) *FileMetaDataBuilder {
	var crypto *format.FileCryptoMetaData
	if props.FileEncryptionProperties() != nil && props.FileEncryptionProperties().EncryptedFooter() {
		crypto = format.NewFileCryptoMetaData()
	}
	return &FileMetaDataBuilder{
		metadata:       format.NewFileMetaData(),
		props:          props,
		schema:         schema,
		kvmeta:         kvmeta,
		cryptoMetadata: crypto,
	}
}

func (f *FileMetaDataBuilder) SetFileEncryptor(encryptor encryption.FileEncryptor) {
	f.fileEncryptor = encryptor
}

// GetFileCryptoMetaData returns the cryptographic information for encrypting/
// decrypting the file.
func (f *FileMetaDataBuilder) GetFileCryptoMetaData() *FileCryptoMetadata {
	if f.cryptoMetadata == nil {
		return nil
	}

	props := f.props.FileEncryptionProperties()
	f.cryptoMetadata.EncryptionAlgorithm = props.Algorithm().ToThrift()
	keyMetadata := props.FooterKeyMetadata()
	if keyMetadata != "" {
		f.cryptoMetadata.KeyMetadata = []byte(keyMetadata)
	}

	return &FileCryptoMetadata{f.cryptoMetadata, 0}
}

// AppendRowGroup adds a rowgroup to the list and returns a builder
// for that row group
func (f *FileMetaDataBuilder) AppendRowGroup() *RowGroupMetaDataBuilder {
	if f.rowGroups == nil {
		f.rowGroups = make([]*format.RowGroup, 0, 1)
	}

	rg := format.NewRowGroup()
	f.rowGroups = append(f.rowGroups, rg)
	f.currentRgBldr = NewRowGroupMetaDataBuilder(f.props, f.schema, rg)
	f.currentRgBldr.fileEncryptor = f.fileEncryptor
	return f.currentRgBldr
}

// AppendKeyValueMetadata appends a key/value pair to the existing key/value metadata
func (f *FileMetaDataBuilder) AppendKeyValueMetadata(key string, value string) error {
	return f.kvmeta.Append(key, value)
}

// Finish will finalize the metadata of the number of rows, row groups,
// version etc. This will clear out this filemetadatabuilder so it can
// be re-used
func (f *FileMetaDataBuilder) Finish() (*FileMetaData, error) {
	out, err := f.Snapshot()
	f.Clear()
	return out, err
}

// Snapshot returns finalized metadata of the number of rows, row groups, version etc.
// The snapshot must be used (e.g., serialized) before any additional (meta)data is
// written, as it refers to builder datastructures that will continue to mutate.
func (f *FileMetaDataBuilder) Snapshot() (*FileMetaData, error) {
	totalRows := int64(0)
	for _, rg := range f.rowGroups {
		totalRows += rg.NumRows
	}
	f.metadata.NumRows = totalRows
	f.metadata.RowGroups = f.rowGroups
	switch f.props.Version() {
	case parquet.V1_0:
		f.metadata.Version = 1
	default:
		f.metadata.Version = 2
	}
	createdBy := f.props.CreatedBy()
	f.metadata.CreatedBy = &createdBy

	// Users cannot set the `ColumnOrder` since we do not have user defined sort order
	// in the spec yet.
	//
	// We always default to `TYPE_DEFINED_ORDER`. We can expose it in
	// the API once we have user defined sort orders in the Parquet format.
	// TypeDefinedOrder implies choose SortOrder based on ConvertedType/PhysicalType
	typeDefined := format.NewTypeDefinedOrder()
	colOrder := &format.ColumnOrder{TYPE_ORDER: typeDefined}
	f.metadata.ColumnOrders = make([]*format.ColumnOrder, f.schema.NumColumns())
	for idx := range f.metadata.ColumnOrders {
		f.metadata.ColumnOrders[idx] = colOrder
	}

	encryptProps := f.props.FileEncryptionProperties()
	if encryptProps != nil && !encryptProps.EncryptedFooter() {
		var signingAlgo parquet.Algorithm
		algo := encryptProps.Algorithm()
		signingAlgo.Aad.AadFileUnique = algo.Aad.AadFileUnique
		signingAlgo.Aad.SupplyAadPrefix = algo.Aad.SupplyAadPrefix
		if !algo.Aad.SupplyAadPrefix {
			signingAlgo.Aad.AadPrefix = algo.Aad.AadPrefix
		}
		signingAlgo.Algo = parquet.AesGcm
		f.metadata.EncryptionAlgorithm = signingAlgo.ToThrift()
		footerSigningMetadata := f.props.FileEncryptionProperties().FooterKeyMetadata()
		if footerSigningMetadata != "" {
			f.metadata.FooterSigningKeyMetadata = []byte(footerSigningMetadata)
		}
	}

	f.metadata.Schema = schema.ToThrift(f.schema.Root())
	f.metadata.KeyValueMetadata = f.kvmeta

	out := &FileMetaData{
		FileMetaData: f.metadata,
		version:      NewAppVersion(f.metadata.GetCreatedBy()),
	}
	if err := out.initSchema(); err != nil {
		return nil, err
	}
	out.initColumnOrders()

	return out, nil
}

func (f *FileMetaDataBuilder) SetPageIndexLocation(loc PageIndexLocation) error {
	setIndexLoc := func(rgOrdinal int64, fileIdxLoc map[uint64][]*IndexLocation, colIndex bool) error {
		rgMeta := f.rowGroups[rgOrdinal]
		iter, ok := fileIdxLoc[uint64(rgOrdinal)]
		if ok {
			for i, idxLoc := range iter {
				if i >= len(rgMeta.Columns) {
					return fmt.Errorf("cannot find metadata for column ordinal %d", i)
				}
				colMeta := rgMeta.Columns[i]
				if idxLoc != nil {
					if colIndex {
						colMeta.ColumnIndexOffset = &idxLoc.Offset
						colMeta.ColumnIndexLength = &idxLoc.Length
					} else {
						colMeta.OffsetIndexOffset = &idxLoc.Offset
						colMeta.OffsetIndexLength = &idxLoc.Length
					}
				}
			}
		}
		return nil
	}

	for rgOrdinal := range f.rowGroups {
		if err := setIndexLoc(int64(rgOrdinal), loc.ColIndexLocation, true); err != nil {
			return err
		}
		if err := setIndexLoc(int64(rgOrdinal), loc.OffsetIndexLocation, false); err != nil {
			return err
		}
	}

	return nil
}

// Clears out this filemetadatabuilder so it can be re-used
func (f *FileMetaDataBuilder) Clear() {
	f.metadata = format.NewFileMetaData()
	f.rowGroups = nil
}

// KeyValueMetadata is an alias for a slice of thrift keyvalue pairs.
//
// It is presumed that the metadata should all be utf8 valid.
type KeyValueMetadata []*format.KeyValue

// NewKeyValueMetadata is equivalent to make(KeyValueMetadata, 0)
func NewKeyValueMetadata() KeyValueMetadata {
	return make(KeyValueMetadata, 0)
}

// Append adds the passed in key and value to the metadata, if either contains
// any invalid utf8 runes, then it is not added and an error is returned.
func (k *KeyValueMetadata) Append(key, value string) error {
	if !utf8.ValidString(key) || !utf8.ValidString(value) {
		return fmt.Errorf("metadata must be valid utf8 strings, got key = '%s' and value = '%s'", key, value)
	}
	*k = append(*k, &format.KeyValue{Key: key, Value: &value})
	return nil
}

func (k KeyValueMetadata) Len() int { return len(k) }

// Equals compares all of the metadata keys and values to check they are equal
func (k KeyValueMetadata) Equals(other KeyValueMetadata) bool {
	return reflect.DeepEqual(k, other)
}

func (k KeyValueMetadata) Keys() (ret []string) {
	ret = make([]string, len(k))
	for idx, v := range k {
		ret[idx] = v.GetKey()
	}
	return
}

func (k KeyValueMetadata) Values() (ret []string) {
	ret = make([]string, len(k))
	for idx, v := range k {
		ret[idx] = v.GetValue()
	}
	return
}

func (k KeyValueMetadata) FindValue(key string) *string {
	for _, v := range k {
		if v.Key == key {
			return v.Value
		}
	}
	return nil
}

// FileMetaData is a proxy around the underlying thrift FileMetaData object
// to make it easier to use and interact with.
type FileMetaData struct {
	*format.FileMetaData
	Schema        *schema.Schema
	FileDecryptor encryption.FileDecryptor

	// app version of the writer for this file
	version *AppVersion
	// size of the raw bytes of the metadata in the file which were
	// decoded by thrift, Size() getter returns the value.
	metadataLen int

	// sourceFileSize is not a part of FileMetaData, but it is mainly used to parse meta data.
	// Users can manually set this value and they are responsible for the validity of it.
	sourceFileSize int64
}

// NewFileMetaData takes in the raw bytes of the serialized metadata to deserialize
// and will attempt to decrypt the footer if a decryptor is provided.
func NewFileMetaData(data []byte, fileDecryptor encryption.FileDecryptor) (*FileMetaData, error) {
	meta := format.NewFileMetaData()
	if fileDecryptor != nil {
		footerDecryptor := fileDecryptor.GetFooterDecryptor()
		data = footerDecryptor.Decrypt(data)
	}

	remain, err := thrift.DeserializeThrift(meta, data)
	if err != nil {
		return nil, err
	}

	f := &FileMetaData{
		FileMetaData:  meta,
		version:       NewAppVersion(meta.GetCreatedBy()),
		metadataLen:   len(data) - int(remain),
		FileDecryptor: fileDecryptor,
	}

	f.initSchema()
	f.initColumnOrders()

	return f, nil
}

// Size is the length of the raw serialized metadata bytes in the footer
func (f *FileMetaData) Size() int { return f.metadataLen }

// GetSourceFileSize get the total size of the source file from meta data.
func (f *FileMetaData) GetSourceFileSize() int64 { return f.sourceFileSize }

// SetSourceFileSize set the total size of the source file in meta data.
func (f *FileMetaData) SetSourceFileSize(sourceFileSize int64) { f.sourceFileSize = sourceFileSize }

// NumSchemaElements is the length of the flattened schema list in the thrift
func (f *FileMetaData) NumSchemaElements() int {
	return len(f.FileMetaData.Schema)
}

// RowGroup provides the metadata for the (0-based) index of the row group
func (f *FileMetaData) RowGroup(i int) *RowGroupMetaData {
	return NewRowGroupMetaData(f.RowGroups[i], f.Schema,
		f.version, f.FileDecryptor)
}

func (f *FileMetaData) Serialize(ctx context.Context) ([]byte, error) {
	return thrift.NewThriftSerializer().Write(ctx, f.FileMetaData)
}

func (f *FileMetaData) SerializeString(ctx context.Context) (string, error) {
	return thrift.NewThriftSerializer().WriteString(ctx, f.FileMetaData)
}

// EncryptionAlgorithm constructs the algorithm object from the thrift
// information or returns an empty instance if it was not set.
func (f *FileMetaData) EncryptionAlgorithm() parquet.Algorithm {
	if f.IsSetEncryptionAlgorithm() {
		return parquet.AlgorithmFromThrift(f.GetEncryptionAlgorithm())
	}
	return parquet.Algorithm{}
}

func (f *FileMetaData) initSchema() error {
	root, err := schema.FromParquet(f.FileMetaData.Schema)
	if err != nil {
		return err
	}
	f.Schema = schema.NewSchema(root.(*schema.GroupNode))
	return nil
}

func (f *FileMetaData) initColumnOrders() {
	orders := make([]parquet.ColumnOrder, 0, f.Schema.NumColumns())
	if f.IsSetColumnOrders() {
		for _, o := range f.GetColumnOrders() {
			if o.IsSetTYPE_ORDER() {
				orders = append(orders, parquet.ColumnOrders.TypeDefinedOrder)
			} else {
				orders = append(orders, parquet.ColumnOrders.Undefined)
			}
		}
	} else if f.Schema.NumColumns() > 0 {
		orders = orders[:f.Schema.NumColumns()]
		orders[0] = parquet.ColumnOrders.Undefined
		for i := 1; i < len(orders); i *= 2 {
			copy(orders[i:], orders[:i])
		}
	}
	f.Schema.UpdateColumnOrders(orders)
}

// WriterVersion returns the constructed application version from the
// created by string
func (f *FileMetaData) WriterVersion() *AppVersion {
	if f.version == nil {
		f.version = NewAppVersion(f.GetCreatedBy())
	}
	return f.version
}

// SetFilePath will set the file path into all of the columns in each row group.
func (f *FileMetaData) SetFilePath(path string) {
	for _, rg := range f.RowGroups {
		for _, chunk := range rg.Columns {
			chunk.FilePath = &path
		}
	}
}

// AppendRowGroups will add all of the rowgroup metadata from other to the
// current file metadata
func (f *FileMetaData) AppendRowGroups(other *FileMetaData) error {
	if !f.Schema.Equals(other.Schema) {
		return xerrors.New("parquet/FileMetaData: AppendRowGroups requires equal schemas")
	}

	f.RowGroups = append(f.RowGroups, other.GetRowGroups()...)
	for _, rg := range other.GetRowGroups() {
		f.NumRows += rg.NumRows
	}
	return nil
}

// Subset will construct a new FileMetaData object containing only the requested
// row groups by index
func (f *FileMetaData) Subset(rowGroups []int) (*FileMetaData, error) {
	for _, i := range rowGroups {
		if i < len(f.RowGroups) {
			continue
		}
		return nil, fmt.Errorf("parquet: this file only has %d row groups, but requested a subset including row group: %d", len(f.RowGroups), i)
	}

	out := &FileMetaData{
		&format.FileMetaData{
			Schema:                   f.FileMetaData.Schema,
			CreatedBy:                f.CreatedBy,
			ColumnOrders:             f.GetColumnOrders(),
			EncryptionAlgorithm:      f.FileMetaData.EncryptionAlgorithm,
			FooterSigningKeyMetadata: f.FooterSigningKeyMetadata,
			Version:                  f.FileMetaData.Version,
			KeyValueMetadata:         f.KeyValueMetadata(),
		},
		f.Schema,
		f.FileDecryptor,
		f.version,
		0,
		f.sourceFileSize,
	}

	out.RowGroups = make([]*format.RowGroup, 0, len(rowGroups))
	for _, selected := range rowGroups {
		out.RowGroups = append(out.RowGroups, f.RowGroups[selected])
		out.NumRows += f.RowGroups[selected].GetNumRows()
	}

	return out, nil
}

func (f *FileMetaData) Equals(other *FileMetaData) bool {
	return reflect.DeepEqual(f.FileMetaData, other.FileMetaData)
}

func (f *FileMetaData) KeyValueMetadata() KeyValueMetadata {
	return f.GetKeyValueMetadata()
}

// VerifySignature constructs a cryptographic signature using the FileDecryptor
// of the footer and then verifies it's integrity.
//
// Panics if f.FileDecryptor is nil
func (f *FileMetaData) VerifySignature(signature []byte) bool {
	if f.FileDecryptor == nil {
		panic("decryption not set properly, cannot verify signature")
	}

	serializer := thrift.NewThriftSerializer()
	data, _ := serializer.Write(context.Background(), f.FileMetaData)
	nonce := signature[:encryption.NonceLength]
	tag := signature[encryption.NonceLength : encryption.NonceLength+encryption.GcmTagLength]

	key := f.FileDecryptor.GetFooterKey()
	aad := encryption.CreateFooterAad(f.FileDecryptor.FileAad())

	enc := encryption.NewAesEncryptor(f.FileDecryptor.Algorithm(), true)
	var buf bytes.Buffer
	buf.Grow(enc.CiphertextSizeDelta() + len(data))
	encryptedLen := enc.SignedFooterEncrypt(&buf, data, []byte(key), []byte(aad), nonce)
	return subtle.ConstantTimeCompare(buf.Bytes()[encryptedLen-encryption.GcmTagLength:], tag) == 1
}

// WriteTo will serialize and write out this file metadata, encrypting it if
// appropriate.
//
// If it is an encrypted file with a plaintext footer, then we will write the
// signature with the unencrypted footer.
func (f *FileMetaData) WriteTo(w io.Writer, encryptor encryption.Encryptor) (int64, error) {
	serializer := thrift.NewThriftSerializer()
	// only in encrypted files with plaintext footers, the encryption algorithm is set in the footer
	if f.IsSetEncryptionAlgorithm() {
		data, err := serializer.Write(context.Background(), f.FileMetaData)
		if err != nil {
			return 0, err
		}

		// encrypt the footer key
		var buf bytes.Buffer
		buf.Grow(encryptor.CiphertextSizeDelta() + len(data))
		encryptedLen := encryptor.Encrypt(&buf, data)

		wrote := 0
		n := 0
		// write unencrypted footer
		if n, err = w.Write(data); err != nil {
			return int64(n), err
		}
		wrote += n
		// write signature (nonce and tag)
		buf.Next(4)
		if n, err = w.Write(buf.Next(encryption.NonceLength)); err != nil {
			return int64(wrote + n), err
		}
		wrote += n
		buf.Next(encryptedLen - 4 - encryption.NonceLength - encryption.GcmTagLength)
		n, err = w.Write(buf.Next(encryption.GcmTagLength))
		return int64(wrote + n), err
	}
	n, err := serializer.Serialize(f.FileMetaData, w, encryptor)
	return int64(n), err
}

// Version returns the "version" of the file
//
// WARNING: The value returned by this method is unreliable as 1) the
// parquet file metadata stores the version as a single integer and
// 2) some producers are known to always write a hardcoded value. Therefore
// you cannot use this value to know which features are used in the file.
func (f *FileMetaData) Version() parquet.Version {
	switch f.FileMetaData.Version {
	case 1:
		return parquet.V1_0
	case 2:
		return parquet.V2_LATEST
	default:
		// improperly set version, assume parquet 1.0
		return parquet.V1_0
	}
}

func (f *FileMetaData) NumRowGroups() int { return len(f.RowGroups) }
func (f *FileMetaData) NumColumns() int   { return f.Schema.NumColumns() }

// FileCryptoMetadata is a proxy for the thrift fileCryptoMetadata object
type FileCryptoMetadata struct {
	metadata          *format.FileCryptoMetaData
	cryptoMetadataLen uint32
}

// NewFileCryptoMetaData takes in the raw serialized bytes to deserialize
// storing the number of bytes that were actually deserialized.
func NewFileCryptoMetaData(metadata []byte) (ret FileCryptoMetadata, err error) {
	ret.metadata = format.NewFileCryptoMetaData()
	var remain uint64
	remain, err = thrift.DeserializeThrift(ret.metadata, metadata)
	ret.cryptoMetadataLen = uint32(uint64(len(metadata)) - remain)
	return
}

// WriteTo writes out the serialized crypto metadata to w
func (fc FileCryptoMetadata) WriteTo(w io.Writer) (int64, error) {
	serializer := thrift.NewThriftSerializer()
	n, err := serializer.Serialize(fc.metadata, w, nil)
	return int64(n), err
}

// Len is the number of bytes that were deserialized to create this object
func (fc FileCryptoMetadata) Len() int { return int(fc.cryptoMetadataLen) }

func (fc FileCryptoMetadata) KeyMetadata() []byte {
	return fc.metadata.KeyMetadata
}

// EncryptionAlgorithm constructs the object from the thrift instance of
// the encryption algorithm
func (fc FileCryptoMetadata) EncryptionAlgorithm() parquet.Algorithm {
	return parquet.AlgorithmFromThrift(fc.metadata.GetEncryptionAlgorithm())
}
