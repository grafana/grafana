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

package parquet

import (
	"crypto/rand"
	"unicode/utf8"

	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
)

// Constants that will be used as the default values with encryption/decryption
const (
	// By default we'll use AesGCM as our encryption algorithm
	DefaultEncryptionAlgorithm       = AesGcm
	MaximalAadMetadataLength   int32 = 256
	// if encryption is turned on, we will default to also encrypting the footer
	DefaultEncryptedFooter = true
	DefaultCheckSignature  = true
	// by default if you set the file decryption properties, we will error
	// on any plaintext files unless otherwise specified.
	DefaultAllowPlaintextFiles       = false
	AadFileUniqueLength        int32 = 8
)

// ColumnPathToDecryptionPropsMap maps column paths to decryption properties
type ColumnPathToDecryptionPropsMap map[string]*ColumnDecryptionProperties

// ColumnPathToEncryptionPropsMap maps column paths to encryption properties
type ColumnPathToEncryptionPropsMap map[string]*ColumnEncryptionProperties

// ColumnEncryptionProperties specifies how to encrypt a given column
type ColumnEncryptionProperties struct {
	columnPath             string
	encrypted              bool
	encryptedWithFooterKey bool
	key                    string
	keyMetadata            string
	utilized               bool
}

// ColumnPath returns which column these properties are for
func (ce *ColumnEncryptionProperties) ColumnPath() string {
	return ce.columnPath
}

// IsEncrypted returns true if this column is encrypted.
func (ce *ColumnEncryptionProperties) IsEncrypted() bool { return ce.encrypted }

// IsEncryptedWithFooterKey returns if this column was encrypted with the footer key itself, or false if a separate
// key was used for encrypting this column.
func (ce *ColumnEncryptionProperties) IsEncryptedWithFooterKey() bool {
	return ce.encryptedWithFooterKey
}

// Key returns the key used for encrypting this column if it isn't encrypted by the footer key
func (ce *ColumnEncryptionProperties) Key() string { return ce.key }

// KeyMetadata returns the key identifier which is used with a KeyRetriever to get the key for this column if it is not
// encrypted using the footer key
func (ce *ColumnEncryptionProperties) KeyMetadata() string { return ce.keyMetadata }

// WipeOutEncryptionKey Clears the encryption key, used after completion of file writing
func (ce *ColumnEncryptionProperties) WipeOutEncryptionKey() { ce.key = "" }

// IsUtilized returns whether or not these properties have already been used, if the key is empty
// then this is always false
func (ce *ColumnEncryptionProperties) IsUtilized() bool {
	if ce.key == "" {
		return false
	}
	return ce.utilized
}

// SetUtilized is used for marking it as utilized once it is used in FileEncryptionProperties
// as the encryption key will be wiped out on completion of writing
func (ce *ColumnEncryptionProperties) SetUtilized() {
	ce.utilized = true
}

// Clone returns a instance of ColumnEncryptionProperties with the same key and metadata
func (ce *ColumnEncryptionProperties) Clone() *ColumnEncryptionProperties {
	copy := ce.key
	return NewColumnEncryptionProperties(ce.columnPath, WithKey(copy), WithKeyMetadata(ce.keyMetadata))
}

type colEncryptConfig struct {
	key         string
	keyMetadata string
	encrypted   bool
}

// ColumnEncryptOption how to specify options to the NewColumnEncryptionProperties function.
type ColumnEncryptOption func(*colEncryptConfig)

// WithKey sets a column specific key.
// If key is not set on an encrypted column, the column will be encrypted with the footer key.
// key length must be either 16, 24, or 32 bytes
// the key is cloned and will be wiped out (array values set to 0) upon completion of file writing.
// Caller is responsible for wiping out input key array
func WithKey(key string) ColumnEncryptOption {
	return func(c *colEncryptConfig) {
		if key != "" {
			c.key = key
		}
	}
}

// WithKeyMetadata sets the key retrieval metadata, use either KeyMetadata or KeyID but not both
func WithKeyMetadata(keyMeta string) ColumnEncryptOption {
	return func(c *colEncryptConfig) {
		c.keyMetadata = keyMeta
	}
}

// WithKeyID is a convenience function to set the key metadata using a string id.
// Set a key retrieval metadata (converted from String). and use either KeyMetadata or KeyID, not both.
// KeyID will be converted to metadata (UTF-8 Array)
func WithKeyID(keyID string) ColumnEncryptOption {
	if !utf8.ValidString(keyID) {
		panic("parquet: key id should be UTF8 encoded")
	}
	return WithKeyMetadata(keyID)
}

// NewColumnEncryptionProperties constructs properties for the provided column path, modified by the options provided
func NewColumnEncryptionProperties(name string, opts ...ColumnEncryptOption) *ColumnEncryptionProperties {
	var cfg colEncryptConfig
	cfg.encrypted = true
	for _, o := range opts {
		o(&cfg)
	}
	return &ColumnEncryptionProperties{
		utilized:               false,
		encrypted:              cfg.encrypted,
		encryptedWithFooterKey: cfg.encrypted && cfg.key == "",
		keyMetadata:            cfg.keyMetadata,
		key:                    cfg.key,
		columnPath:             name,
	}
}

// ColumnDecryptionProperties are the specifications for how to decrypt a given column.
type ColumnDecryptionProperties struct {
	columnPath string
	key        string
	utilized   bool
}

// NewColumnDecryptionProperties constructs a new ColumnDecryptionProperties for the given column path, modified by
// the provided options
func NewColumnDecryptionProperties(column string, opts ...ColumnDecryptOption) *ColumnDecryptionProperties {
	var cfg columnDecryptConfig
	for _, o := range opts {
		o(&cfg)
	}

	return &ColumnDecryptionProperties{
		columnPath: column,
		utilized:   false,
		key:        cfg.key,
	}
}

// ColumnPath returns which column these properties describe how to decrypt
func (cd *ColumnDecryptionProperties) ColumnPath() string { return cd.columnPath }

// Key returns the key specified to decrypt this column, or is empty if the Footer Key should be used.
func (cd *ColumnDecryptionProperties) Key() string { return cd.key }

// IsUtilized returns whether or not these properties have been used for decryption already
func (cd *ColumnDecryptionProperties) IsUtilized() bool { return cd.utilized }

// SetUtilized is used by the reader to specify when we've decrypted the column and have used the key so we know
// to wipe out the keys.
func (cd *ColumnDecryptionProperties) SetUtilized() { cd.utilized = true }

// WipeOutDecryptionKey is called after decryption to ensure the key doesn't stick around and get re-used.
func (cd *ColumnDecryptionProperties) WipeOutDecryptionKey() { cd.key = "" }

// Clone returns a new instance of ColumnDecryptionProperties with the same key and column
func (cd *ColumnDecryptionProperties) Clone() *ColumnDecryptionProperties {
	return NewColumnDecryptionProperties(cd.columnPath, WithDecryptKey(cd.key))
}

type columnDecryptConfig struct {
	key string
}

// ColumnDecryptOption is the type of the options passed for constructing Decryption Properties
type ColumnDecryptOption func(*columnDecryptConfig)

// WithDecryptKey specifies the key to utilize for decryption
func WithDecryptKey(key string) ColumnDecryptOption {
	return func(cfg *columnDecryptConfig) {
		if key != "" {
			cfg.key = key
		}
	}
}

// AADPrefixVerifier is an interface for any object that can be used to verify the identity of the file being decrypted.
// It should panic if the provided AAD identity is bad.
//
// In a data set, AAD Prefixes should be collected, and then checked for missing files.
type AADPrefixVerifier interface {
	// Verify identity of file. panic if bad
	Verify(string)
}

// DecryptionKeyRetriever is an interface for getting the desired key for decryption from metadata. It should take in
// some metadata identifier and return the actual Key to use for decryption.
type DecryptionKeyRetriever interface {
	GetKey(keyMetadata []byte) string
}

// FileDecryptionProperties define the File Level configuration for decrypting a parquet file. Once constructed they are
// read only.
type FileDecryptionProperties struct {
	footerKey                     string
	aadPrefix                     string
	checkPlaintextFooterIntegrity bool
	plaintextAllowed              bool
	utilized                      bool
	columnDecryptProps            ColumnPathToDecryptionPropsMap
	Verifier                      AADPrefixVerifier
	KeyRetriever                  DecryptionKeyRetriever
}

// NewFileDecryptionProperties takes in the options for constructing a new FileDecryptionProperties object, otherwise
// it will use the default configuration which will check footer integrity of a plaintext footer for an encrypted file
// for unencrypted parquet files, the decryption properties should not be set.
func NewFileDecryptionProperties(opts ...FileDecryptionOption) *FileDecryptionProperties {
	var cfg fileDecryptConfig
	cfg.checkFooterIntegrity = DefaultCheckSignature
	cfg.plaintextAllowed = DefaultAllowPlaintextFiles
	for _, o := range opts {
		o(&cfg)
	}
	return &FileDecryptionProperties{
		Verifier:                      cfg.verifier,
		footerKey:                     cfg.footerKey,
		checkPlaintextFooterIntegrity: cfg.checkFooterIntegrity,
		KeyRetriever:                  cfg.retriever,
		aadPrefix:                     cfg.aadPrefix,
		columnDecryptProps:            cfg.colDecrypt,
		plaintextAllowed:              cfg.plaintextAllowed,
		utilized:                      false,
	}
}

// ColumnKey returns the key to be used for decrypting the provided column.
func (fd *FileDecryptionProperties) ColumnKey(path string) string {
	if d, ok := fd.columnDecryptProps[path]; ok {
		if d != nil {
			return d.Key()
		}
	}
	return ""
}

// FooterKey returns the key utilized for decrypting the Footer if encrypted and any columns that are encrypted with
// the footer key.
func (fd *FileDecryptionProperties) FooterKey() string { return fd.footerKey }

// AadPrefix returns the prefix to be supplied for constructing the identification strings when decrypting
func (fd *FileDecryptionProperties) AadPrefix() string { return fd.aadPrefix }

// PlaintextFooterIntegrity returns whether or not an integrity check will be performed on a plaintext footer for an
// encrypted file.
func (fd *FileDecryptionProperties) PlaintextFooterIntegrity() bool {
	return fd.checkPlaintextFooterIntegrity
}

// PlaintextFilesAllowed returns whether or not this instance of decryption properties are allowed on a plaintext file.
func (fd *FileDecryptionProperties) PlaintextFilesAllowed() bool { return fd.plaintextAllowed }

// SetUtilized is called to mark this instance as utilized once it is used to read a file. A single instance
// can be used for reading one file only. Setting this ensures the keys will be wiped out upon completion of file reading.
func (fd *FileDecryptionProperties) SetUtilized() { fd.utilized = true }

// IsUtilized returns whether or not this instance has been used to decrypt a file. If the footer key and prefix are
// empty and there are no column decryption properties, then this is always false.
func (fd *FileDecryptionProperties) IsUtilized() bool {
	if fd.footerKey == "" && len(fd.columnDecryptProps) == 0 && fd.aadPrefix == "" {
		return false
	}
	return fd.utilized
}

// WipeOutDecryptionKeys will clear all the keys for this instance including the column level ones, this will be called
// after this instance has been utilized.
func (fd *FileDecryptionProperties) WipeOutDecryptionKeys() {
	fd.footerKey = ""
	for _, cd := range fd.columnDecryptProps {
		cd.WipeOutDecryptionKey()
	}
}

// Clone returns a new instance of these properties, changing the prefix if set (keeping the same prefix if left empty)
func (fd *FileDecryptionProperties) Clone(newAadPrefix string) *FileDecryptionProperties {
	keyCopy := fd.footerKey
	colDecryptMapCopy := make(ColumnPathToDecryptionPropsMap)
	for k, v := range fd.columnDecryptProps {
		colDecryptMapCopy[k] = v.Clone()
	}
	if newAadPrefix == "" {
		newAadPrefix = fd.aadPrefix
	}
	return &FileDecryptionProperties{
		footerKey:                     keyCopy,
		KeyRetriever:                  fd.KeyRetriever,
		checkPlaintextFooterIntegrity: fd.checkPlaintextFooterIntegrity,
		Verifier:                      fd.Verifier,
		columnDecryptProps:            colDecryptMapCopy,
		aadPrefix:                     newAadPrefix,
		plaintextAllowed:              fd.plaintextAllowed,
		utilized:                      false,
	}
}

type fileDecryptConfig struct {
	footerKey            string
	aadPrefix            string
	verifier             AADPrefixVerifier
	colDecrypt           ColumnPathToDecryptionPropsMap
	retriever            DecryptionKeyRetriever
	checkFooterIntegrity bool
	plaintextAllowed     bool
}

// FileDecryptionOption is how to supply options to constructing a new FileDecryptionProperties instance.
type FileDecryptionOption func(*fileDecryptConfig)

// WithFooterKey sets an explicit footer key. If Applied on a file that contains footer key
// metadata the metadata will be ignored, the footer will be decrypted/verified with this key.
//
// If the explicit key is not set, footer key will be fetched from the key retriever.
// With explicit keys or AAD prefix, new encryption properties object must be created for each
// encrypted file.
//
// Explicit encryption keys (footer and column) are cloned.
// Upon completion of file reading, the cloned encryption keys in the properties will be wiped out
// Caller is responsible for wiping out the input key array
// footer key length must be either 16, 24, or 32 bytes
func WithFooterKey(key string) FileDecryptionOption {
	return func(cfg *fileDecryptConfig) {
		if key != "" {
			cfg.footerKey = key
		}
	}
}

// WithPrefixVerifier supplies a verifier object to use for verifying the AAD Prefixes stored in the file.
func WithPrefixVerifier(verifier AADPrefixVerifier) FileDecryptionOption {
	return func(cfg *fileDecryptConfig) {
		if verifier != nil {
			cfg.verifier = verifier
		}
	}
}

// WithColumnKeys sets explicit column keys.
//
// It's also possible to set a key retriever on this property object.
//
// Upon file decryption, availability of explicit keys is checked before invocation
// of the retriever callback.
//
// If an explicit key is available for a footer or a column, its key metadata will be ignored.
func WithColumnKeys(decrypt ColumnPathToDecryptionPropsMap) FileDecryptionOption {
	return func(cfg *fileDecryptConfig) {
		if len(decrypt) == 0 {
			return
		}
		if len(cfg.colDecrypt) != 0 {
			panic("column properties already set")
		}
		for _, v := range decrypt {
			if v.IsUtilized() {
				panic("parquet: column properties utilized in another file")
			}
			v.SetUtilized()
		}
		cfg.colDecrypt = decrypt
	}
}

// WithKeyRetriever sets a key retriever callback. It's also possible to set explicit footer or column keys.
func WithKeyRetriever(retriever DecryptionKeyRetriever) FileDecryptionOption {
	return func(cfg *fileDecryptConfig) {
		if retriever != nil {
			cfg.retriever = retriever
		}
	}
}

// DisableFooterSignatureVerification skips integrity verification of plaintext footers.
//
// If not called, integrity of plaintext footers will be checked in runtime, and will panic
// if the footer signing key is not available
// or if the footer content and signature don't match
func DisableFooterSignatureVerification() FileDecryptionOption {
	return func(cfg *fileDecryptConfig) {
		cfg.checkFooterIntegrity = false
	}
}

// WithPlaintextAllowed sets allowing plaintext files.
//
// By default, reading plaintext (unencrypted) files is not allowed when using
// a decryptor.
//
// In order to detect files that were not encrypted by mistake.
// However the default behavior can be overridden by using this method.
func WithPlaintextAllowed() FileDecryptionOption {
	return func(cfg *fileDecryptConfig) {
		cfg.plaintextAllowed = true
	}
}

// WithDecryptAadPrefix explicitly supplies the file aad prefix.
//
// A must when a prefix is used for file encryption, but not stored in the file.
func WithDecryptAadPrefix(prefix string) FileDecryptionOption {
	return func(cfg *fileDecryptConfig) {
		if prefix != "" {
			cfg.aadPrefix = prefix
		}
	}
}

// Algorithm describes how something was encrypted, representing the EncryptionAlgorithm object from the
// parquet.thrift file.
type Algorithm struct {
	Algo Cipher
	Aad  struct {
		AadPrefix       []byte
		AadFileUnique   []byte
		SupplyAadPrefix bool
	}
}

// ToThrift returns an instance to be used for serializing when writing a file.
func (e Algorithm) ToThrift() *format.EncryptionAlgorithm {
	if e.Algo == AesGcm {
		return &format.EncryptionAlgorithm{
			AES_GCM_V1: &format.AesGcmV1{
				AadPrefix:       e.Aad.AadPrefix,
				AadFileUnique:   e.Aad.AadFileUnique,
				SupplyAadPrefix: &e.Aad.SupplyAadPrefix,
			},
		}
	}
	return &format.EncryptionAlgorithm{
		AES_GCM_CTR_V1: &format.AesGcmCtrV1{
			AadPrefix:       e.Aad.AadPrefix,
			AadFileUnique:   e.Aad.AadFileUnique,
			SupplyAadPrefix: &e.Aad.SupplyAadPrefix,
		},
	}
}

// AlgorithmFromThrift converts the thrift object to the Algorithm struct for easier usage.
func AlgorithmFromThrift(enc *format.EncryptionAlgorithm) (ret Algorithm) {
	if enc.IsSetAES_GCM_V1() {
		ret.Algo = AesGcm
		ret.Aad.AadFileUnique = enc.AES_GCM_V1.AadFileUnique
		ret.Aad.AadPrefix = enc.AES_GCM_V1.AadPrefix
		ret.Aad.SupplyAadPrefix = *enc.AES_GCM_V1.SupplyAadPrefix
		return
	}
	ret.Algo = AesCtr
	ret.Aad.AadFileUnique = enc.AES_GCM_CTR_V1.AadFileUnique
	ret.Aad.AadPrefix = enc.AES_GCM_CTR_V1.AadPrefix
	ret.Aad.SupplyAadPrefix = *enc.AES_GCM_CTR_V1.SupplyAadPrefix
	return
}

// FileEncryptionProperties describe how to encrypt a parquet file when writing data.
type FileEncryptionProperties struct {
	alg                  Algorithm
	footerKey            string
	footerKeyMetadata    string
	encryptedFooter      bool
	fileAad              string
	utilized             bool
	storeAadPrefixInFile bool
	aadPrefix            string
	encryptedCols        ColumnPathToEncryptionPropsMap
}

// EncryptedFooter returns if the footer for this file should be encrypted or left in plaintext.
func (fe *FileEncryptionProperties) EncryptedFooter() bool { return fe.encryptedFooter }

// Algorithm returns the description of how we will perform the encryption, the algorithm, prefixes, and so on.
func (fe *FileEncryptionProperties) Algorithm() Algorithm { return fe.alg }

// FooterKey returns the actual key used to encrypt the footer if it is encrypted, or to encrypt any columns which
// will be encrypted with it rather than their own keys.
func (fe *FileEncryptionProperties) FooterKey() string { return fe.footerKey }

// FooterKeyMetadata is used for retrieving a key from the key retriever in order to set the footer key
func (fe *FileEncryptionProperties) FooterKeyMetadata() string { return fe.footerKeyMetadata }

// FileAad returns the aad identification to be used at the file level which gets concatenated with the row and column
// information for encrypting data.
func (fe *FileEncryptionProperties) FileAad() string { return fe.fileAad }

// IsUtilized returns whether or not this instance has been used to encrypt a file
func (fe *FileEncryptionProperties) IsUtilized() bool { return fe.utilized }

// SetUtilized is called after writing a file. A FileEncryptionProperties object can be used for writing one file only,
// the encryption keys will be wiped out upon completion of writing the file.
func (fe *FileEncryptionProperties) SetUtilized() { fe.utilized = true }

// EncryptedColumns returns the mapping of column paths to column encryption properties
func (fe *FileEncryptionProperties) EncryptedColumns() ColumnPathToEncryptionPropsMap {
	return fe.encryptedCols
}

// ColumnEncryptionProperties returns the properties for encrypting a given column.
//
// This may be nil for columns that aren't encrypted or may be default properties.
func (fe *FileEncryptionProperties) ColumnEncryptionProperties(path string) *ColumnEncryptionProperties {
	if len(fe.encryptedCols) == 0 {
		return NewColumnEncryptionProperties(path)
	}
	if c, ok := fe.encryptedCols[path]; ok {
		return c
	}
	return nil
}

// Clone allows returning an identical property setup for another file with the option to update the aadPrefix,
// (if given the empty string, the current aad prefix will be used) since a single instance can only be used
// to encrypt one file before wiping out the keys.
func (fe *FileEncryptionProperties) Clone(newAadPrefix string) *FileEncryptionProperties {
	footerKeyCopy := fe.footerKey
	encryptedColsCopy := make(ColumnPathToEncryptionPropsMap)
	for k, v := range fe.encryptedCols {
		encryptedColsCopy[k] = v.Clone()
	}
	if newAadPrefix == "" {
		newAadPrefix = fe.aadPrefix
	}

	opts := []EncryptOption{
		WithAlg(fe.alg.Algo), WithFooterKeyMetadata(fe.footerKeyMetadata),
		WithAadPrefix(newAadPrefix), WithEncryptedColumns(encryptedColsCopy),
	}
	if !fe.encryptedFooter {
		opts = append(opts, WithPlaintextFooter())
	}
	if !fe.storeAadPrefixInFile {
		opts = append(opts, DisableAadPrefixStorage())
	}
	return NewFileEncryptionProperties(footerKeyCopy, opts...)
}

// WipeOutEncryptionKeys clears all of the encryption keys for this and the columns
func (fe *FileEncryptionProperties) WipeOutEncryptionKeys() {
	fe.footerKey = ""
	for _, elem := range fe.encryptedCols {
		elem.WipeOutEncryptionKey()
	}
}

type configEncrypt struct {
	cipher               Cipher
	encryptFooter        bool
	keyMetadata          string
	aadprefix            string
	storeAadPrefixInFile bool
	encryptedCols        ColumnPathToEncryptionPropsMap
}

// EncryptOption is used for specifying values when building FileEncryptionProperties
type EncryptOption func(*configEncrypt)

// WithPlaintextFooter sets the writer to write the footer in plain text, otherwise the footer will be encrypted
// too (which is the default behavior).
func WithPlaintextFooter() EncryptOption {
	return func(cfg *configEncrypt) {
		cfg.encryptFooter = false
	}
}

// WithAlg sets the encryption algorithm to utilize. (default is AesGcm)
func WithAlg(cipher Cipher) EncryptOption {
	return func(cfg *configEncrypt) {
		cfg.cipher = cipher
	}
}

// WithFooterKeyID sets a key retrieval metadata to use (converted from string), this must be a utf8 string.
//
// use either WithFooterKeyID or WithFooterKeyMetadata, not both.
func WithFooterKeyID(key string) EncryptOption {
	if !utf8.ValidString(key) {
		panic("parquet: footer key id should be UTF8 encoded")
	}
	return WithFooterKeyMetadata(key)
}

// WithFooterKeyMetadata sets a key retrieval metadata to use for getting the key.
//
// Use either WithFooterKeyID or WithFooterKeyMetadata, not both.
func WithFooterKeyMetadata(keyMeta string) EncryptOption {
	return func(cfg *configEncrypt) {
		if keyMeta != "" {
			cfg.keyMetadata = keyMeta
		}
	}
}

// WithAadPrefix sets the AAD prefix to use for encryption and by default will store it in the file
func WithAadPrefix(aadPrefix string) EncryptOption {
	return func(cfg *configEncrypt) {
		if aadPrefix != "" {
			cfg.aadprefix = aadPrefix
			cfg.storeAadPrefixInFile = true
		}
	}
}

// DisableAadPrefixStorage will set the properties to not store the AadPrefix in the file. If this isn't called
// and the AadPrefix is set, then it will be stored. This needs to in the options *after* WithAadPrefix to have an effect.
func DisableAadPrefixStorage() EncryptOption {
	return func(cfg *configEncrypt) {
		cfg.storeAadPrefixInFile = false
	}
}

// WithEncryptedColumns sets the map of columns and their properties (keys etc.) If not called, then all columns will
// be encrypted with the footer key. If called, then columns not in the map will be left unencrypted.
func WithEncryptedColumns(encrypted ColumnPathToEncryptionPropsMap) EncryptOption {
	none := func(*configEncrypt) {}
	if len(encrypted) == 0 {
		return none
	}
	return func(cfg *configEncrypt) {
		if len(cfg.encryptedCols) != 0 {
			panic("column properties already set")
		}
		for _, v := range encrypted {
			if v.IsUtilized() {
				panic("column properties utilized in another file")
			}
			v.SetUtilized()
		}
		cfg.encryptedCols = encrypted
	}
}

// NewFileEncryptionProperties returns a new File Encryption description object using the options provided.
func NewFileEncryptionProperties(footerKey string, opts ...EncryptOption) *FileEncryptionProperties {
	var cfg configEncrypt
	cfg.cipher = DefaultEncryptionAlgorithm
	cfg.encryptFooter = DefaultEncryptedFooter
	for _, o := range opts {
		o(&cfg)
	}

	props := &FileEncryptionProperties{
		footerKey:            footerKey,
		footerKeyMetadata:    cfg.keyMetadata,
		encryptedFooter:      cfg.encryptFooter,
		aadPrefix:            cfg.aadprefix,
		storeAadPrefixInFile: cfg.storeAadPrefixInFile,
		encryptedCols:        cfg.encryptedCols,
		utilized:             false,
	}

	aadFileUnique := [AadFileUniqueLength]uint8{}
	_, err := rand.Read(aadFileUnique[:])
	if err != nil {
		panic(err)
	}

	supplyAadPrefix := false
	if props.aadPrefix == "" {
		props.fileAad = string(aadFileUnique[:])
	} else {
		props.fileAad = props.aadPrefix + string(aadFileUnique[:])
		if !props.storeAadPrefixInFile {
			supplyAadPrefix = true
		}
	}
	props.alg.Algo = cfg.cipher
	props.alg.Aad.AadFileUnique = aadFileUnique[:]
	props.alg.Aad.SupplyAadPrefix = supplyAadPrefix
	if cfg.aadprefix != "" && cfg.storeAadPrefixInFile {
		props.alg.Aad.AadPrefix = []byte(props.aadPrefix)
	}
	return props
}
