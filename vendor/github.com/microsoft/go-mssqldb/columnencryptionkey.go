package mssql

const (
	CertificateStoreKeyProvider = "MSSQL_CERTIFICATE_STORE"
	CspKeyProvider              = "MSSQL_CSP_PROVIDER"
	CngKeyProvider              = "MSSQL_CNG_STORE"
	AzureKeyVaultKeyProvider    = "AZURE_KEY_VAULT"
	JavaKeyProvider             = "MSSQL_JAVA_KEYSTORE"
	KeyEncryptionAlgorithm      = "RSA_OAEP"
)

// cek ==> Column Encryption Key
// Every row of an encrypted table has an associated list of keys used to decrypt its columns
type cekTable struct {
	entries []cekTableEntry
}

type encryptionKeyInfo struct {
	encryptedKey  []byte
	databaseID    int
	cekID         int
	cekVersion    int
	cekMdVersion  []byte
	keyPath       string
	keyStoreName  string
	algorithmName string
}

type cekTableEntry struct {
	databaseID int
	keyId      int
	keyVersion int
	mdVersion  []byte
	valueCount int
	cekValues  []encryptionKeyInfo
}

func newCekTable(size uint16) cekTable {
	return cekTable{entries: make([]cekTableEntry, size)}
}
