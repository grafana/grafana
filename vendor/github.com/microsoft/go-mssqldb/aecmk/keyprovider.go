package aecmk

import (
	"context"
	"fmt"
	"sync"
	"time"
)

const (
	CertificateStoreKeyProvider = "MSSQL_CERTIFICATE_STORE"
	CspKeyProvider              = "MSSQL_CSP_PROVIDER"
	CngKeyProvider              = "MSSQL_CNG_STORE"
	AzureKeyVaultKeyProvider    = "AZURE_KEY_VAULT"
	JavaKeyProvider             = "MSSQL_JAVA_KEYSTORE"
	KeyEncryptionAlgorithm      = "RSA_OAEP"
)

// ColumnEncryptionKeyLifetime is the default lifetime of decrypted Column Encryption Keys in the global cache.
// The default is 2 hours
var ColumnEncryptionKeyLifetime time.Duration = 2 * time.Hour

type cekCacheEntry struct {
	Expiry time.Time
	Key    []byte
}

type cekCache map[string]cekCacheEntry

type CekProvider struct {
	Provider      ColumnEncryptionKeyProvider
	decryptedKeys cekCache
	mutex         sync.Mutex
}

func NewCekProvider(provider ColumnEncryptionKeyProvider) *CekProvider {
	return &CekProvider{Provider: provider, decryptedKeys: make(cekCache), mutex: sync.Mutex{}}
}

func (cp *CekProvider) GetDecryptedKey(ctx context.Context, keyPath string, encryptedBytes []byte) (decryptedKey []byte, err error) {
	cp.mutex.Lock()
	ev, cachedKey := cp.decryptedKeys[keyPath]
	if cachedKey {
		if ev.Expiry.Before(time.Now()) {
			delete(cp.decryptedKeys, keyPath)
			cachedKey = false
		} else {
			decryptedKey = ev.Key
		}
	}
	// decrypting a key can take a while, so let multiple callers race
	// Key providers can choose to optimize their own concurrency.
	// For example - there's probably minimal value in serializing access to a local certificate,
	// but there'd be high value in having a queue of waiters for decrypting a key stored in the cloud.
	cp.mutex.Unlock()
	if !cachedKey {
		decryptedKey, err = cp.Provider.DecryptColumnEncryptionKey(ctx, keyPath, KeyEncryptionAlgorithm, encryptedBytes)
	}
	if err == nil && !cachedKey {
		duration := cp.Provider.KeyLifetime()
		if duration == nil {
			duration = &ColumnEncryptionKeyLifetime
		}
		expiry := time.Now().Add(*duration)
		cp.mutex.Lock()
		cp.decryptedKeys[keyPath] = cekCacheEntry{Expiry: expiry, Key: decryptedKey}
		cp.mutex.Unlock()
	}
	return
}

// no synchronization on this map. Providers register during init.
type ColumnEncryptionKeyProviderMap map[string]*CekProvider

var globalCekProviderFactoryMap = ColumnEncryptionKeyProviderMap{}

// ColumnEncryptionKeyProvider is the interface for decrypting and encrypting column encryption keys.
// It is similar to .Net https://learn.microsoft.com/dotnet/api/microsoft.data.sqlclient.sqlcolumnencryptionkeystoreprovider.
type ColumnEncryptionKeyProvider interface {
	// DecryptColumnEncryptionKey decrypts the specified encrypted value of a column encryption key.
	// The encrypted value is expected to be encrypted using the column master key with the specified key path and using the specified algorithm.
	DecryptColumnEncryptionKey(ctx context.Context, masterKeyPath string, encryptionAlgorithm string, encryptedCek []byte) ([]byte, error)
	// EncryptColumnEncryptionKey encrypts a column encryption key using the column master key with the specified key path and using the specified algorithm.
	EncryptColumnEncryptionKey(ctx context.Context, masterKeyPath string, encryptionAlgorithm string, cek []byte) ([]byte, error)
	// SignColumnMasterKeyMetadata digitally signs the column master key metadata with the column master key
	// referenced by the masterKeyPath parameter. The input values used to generate the signature should be the
	// specified values of the masterKeyPath and allowEnclaveComputations parameters. May return an empty slice if not supported.
	SignColumnMasterKeyMetadata(ctx context.Context, masterKeyPath string, allowEnclaveComputations bool) ([]byte, error)
	// VerifyColumnMasterKeyMetadata verifies the specified signature is valid for the column master key
	// with the specified key path and the specified enclave behavior. Return nil if not supported.
	VerifyColumnMasterKeyMetadata(ctx context.Context, masterKeyPath string, allowEnclaveComputations bool) (*bool, error)
	// KeyLifetime is an optional Duration. Keys fetched by this provider will be discarded after their lifetime expires.
	// If it returns nil, the keys will expire based on the value of ColumnEncryptionKeyLifetime.
	// If it returns zero, the keys will not be cached.
	KeyLifetime() *time.Duration
}

// RegisterCekProvider adds the named provider to the global provider list
func RegisterCekProvider(name string, provider ColumnEncryptionKeyProvider) error {
	_, ok := globalCekProviderFactoryMap[name]
	if ok {
		return fmt.Errorf("CEK provider %s is already registered", name)
	}
	globalCekProviderFactoryMap[name] = &CekProvider{Provider: provider, decryptedKeys: cekCache{}, mutex: sync.Mutex{}}
	return nil
}

// GetGlobalCekProviders enumerates all globally registered providers
func GetGlobalCekProviders() (providers ColumnEncryptionKeyProviderMap) {
	providers = make(ColumnEncryptionKeyProviderMap)
	for i, p := range globalCekProviderFactoryMap {
		providers[i] = p
	}
	return
}
