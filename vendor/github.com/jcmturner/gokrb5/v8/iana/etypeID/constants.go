// Package etypeID provides Kerberos 5 encryption type assigned numbers.
package etypeID

// Kerberos encryption type assigned numbers.
const (
	//RESERVED : 0
	DES_CBC_CRC                  int32 = 1
	DES_CBC_MD4                  int32 = 2
	DES_CBC_MD5                  int32 = 3
	DES_CBC_RAW                  int32 = 4
	DES3_CBC_MD5                 int32 = 5
	DES3_CBC_RAW                 int32 = 6
	DES3_CBC_SHA1                int32 = 7
	DES_HMAC_SHA1                int32 = 8
	DSAWITHSHA1_CMSOID           int32 = 9
	MD5WITHRSAENCRYPTION_CMSOID  int32 = 10
	SHA1WITHRSAENCRYPTION_CMSOID int32 = 11
	RC2CBC_ENVOID                int32 = 12
	RSAENCRYPTION_ENVOID         int32 = 13
	RSAES_OAEP_ENV_OID           int32 = 14
	DES_EDE3_CBC_ENV_OID         int32 = 15
	DES3_CBC_SHA1_KD             int32 = 16
	AES128_CTS_HMAC_SHA1_96      int32 = 17
	AES256_CTS_HMAC_SHA1_96      int32 = 18
	AES128_CTS_HMAC_SHA256_128   int32 = 19
	AES256_CTS_HMAC_SHA384_192   int32 = 20
	//UNASSIGNED : 21-22
	RC4_HMAC             int32 = 23
	RC4_HMAC_EXP         int32 = 24
	CAMELLIA128_CTS_CMAC int32 = 25
	CAMELLIA256_CTS_CMAC int32 = 26
	//UNASSIGNED : 27-64
	SUBKEY_KEYMATERIAL int32 = 65
	//UNASSIGNED : 66-2147483647
)

// ETypesByName is a map of EncType names to their assigned EncType number.
var ETypesByName = map[string]int32{
	"des-cbc-crc":                  DES_CBC_CRC,
	"des-cbc-md4":                  DES_CBC_MD4,
	"des-cbc-md5":                  DES_CBC_MD5,
	"des-cbc-raw":                  DES_CBC_RAW,
	"des3-cbc-md5":                 DES3_CBC_MD5,
	"des3-cbc-raw":                 DES3_CBC_RAW,
	"des3-cbc-sha1":                DES3_CBC_SHA1,
	"des3-hmac-sha1":               DES_HMAC_SHA1,
	"des3-cbc-sha1-kd":             DES3_CBC_SHA1_KD,
	"des-hmac-sha1":                DES_HMAC_SHA1,
	"dsaWithSHA1-CmsOID":           DSAWITHSHA1_CMSOID,
	"md5WithRSAEncryption-CmsOID":  MD5WITHRSAENCRYPTION_CMSOID,
	"sha1WithRSAEncryption-CmsOID": SHA1WITHRSAENCRYPTION_CMSOID,
	"rc2CBC-EnvOID":                RC2CBC_ENVOID,
	"rsaEncryption-EnvOID":         RSAENCRYPTION_ENVOID,
	"rsaES-OAEP-ENV-OID":           RSAES_OAEP_ENV_OID,
	"des-ede3-cbc-Env-OID":         DES_EDE3_CBC_ENV_OID,
	"aes128-cts-hmac-sha1-96":      AES128_CTS_HMAC_SHA1_96,
	"aes128-cts":                   AES128_CTS_HMAC_SHA1_96,
	"aes128-sha1":                  AES128_CTS_HMAC_SHA1_96,
	"aes256-cts-hmac-sha1-96":      AES256_CTS_HMAC_SHA1_96,
	"aes256-cts":                   AES256_CTS_HMAC_SHA1_96,
	"aes256-sha1":                  AES256_CTS_HMAC_SHA1_96,
	"aes128-cts-hmac-sha256-128":   AES128_CTS_HMAC_SHA256_128,
	"aes128-sha2":                  AES128_CTS_HMAC_SHA256_128,
	"aes256-cts-hmac-sha384-192":   AES256_CTS_HMAC_SHA384_192,
	"aes256-sha2":                  AES256_CTS_HMAC_SHA384_192,
	"arcfour-hmac":                 RC4_HMAC,
	"rc4-hmac":                     RC4_HMAC,
	"arcfour-hmac-md5":             RC4_HMAC,
	"arcfour-hmac-exp":             RC4_HMAC_EXP,
	"rc4-hmac-exp":                 RC4_HMAC_EXP,
	"arcfour-hmac-md5-exp":         RC4_HMAC_EXP,
	"camellia128-cts-cmac":         CAMELLIA128_CTS_CMAC,
	"camellia128-cts":              CAMELLIA128_CTS_CMAC,
	"camellia256-cts-cmac":         CAMELLIA256_CTS_CMAC,
	"camellia256-cts":              CAMELLIA256_CTS_CMAC,
	"subkey-keymaterial":           SUBKEY_KEYMATERIAL,
}

// EtypeSupported resolves the etype name string to the etype ID.
// If zero is returned the etype is not supported by gokrb5.
func EtypeSupported(etype string) int32 {
	// Slice of supported enctype IDs
	s := []int32{
		AES128_CTS_HMAC_SHA1_96,
		AES256_CTS_HMAC_SHA1_96,
		AES128_CTS_HMAC_SHA256_128,
		AES256_CTS_HMAC_SHA384_192,
		DES3_CBC_SHA1_KD,
		RC4_HMAC,
	}
	id := ETypesByName[etype]
	if id == 0 {
		return id
	}
	for _, sid := range s {
		if id == sid {
			return id
		}
	}
	return 0
}
