// Package chksumtype provides Kerberos 5 checksum type assigned numbers.
package chksumtype

// Checksum type IDs.
const (
	//RESERVED : 0
	CRC32         int32 = 1
	RSA_MD4       int32 = 2
	RSA_MD4_DES   int32 = 3
	DES_MAC       int32 = 4
	DES_MAC_K     int32 = 5
	RSA_MD4_DES_K int32 = 6
	RSA_MD5       int32 = 7
	RSA_MD5_DES   int32 = 8
	RSA_MD5_DES3  int32 = 9
	SHA1_ID10     int32 = 10
	//UNASSIGNED : 11
	HMAC_SHA1_DES3_KD      int32 = 12
	HMAC_SHA1_DES3         int32 = 13
	SHA1_ID14              int32 = 14
	HMAC_SHA1_96_AES128    int32 = 15
	HMAC_SHA1_96_AES256    int32 = 16
	CMAC_CAMELLIA128       int32 = 17
	CMAC_CAMELLIA256       int32 = 18
	HMAC_SHA256_128_AES128 int32 = 19
	HMAC_SHA384_192_AES256 int32 = 20
	//UNASSIGNED : 21-32770
	GSSAPI int32 = 32771
	//UNASSIGNED : 32772-2147483647
	KERB_CHECKSUM_HMAC_MD5_UNSIGNED uint32 = 4294967158 // 0xFFFFFF76 documentation says this is -138 but in an unsigned int this is 4294967158
	KERB_CHECKSUM_HMAC_MD5          int32  = -138
)
