pkcs8
===
OpenSSL can generate private keys in both "traditional format" and PKCS#8 format. Newer applications are advised to use more secure PKCS#8 format. Go standard crypto package provides a [function](http://golang.org/pkg/crypto/x509/#ParsePKCS8PrivateKey) to parse private key in PKCS#8 format. There is a limitation to this function. It can only handle unencrypted PKCS#8 private keys. To use this function, the user has to save the private key in file without encryption, which is a bad practice to leave private keys unprotected on file systems. In addition, Go standard package lacks the functions to convert RSA/ECDSA private keys into PKCS#8 format.

pkcs8 package fills the gap here. It implements functions to process private keys in PKCS#8 format, as defined in [RFC5208](https://tools.ietf.org/html/rfc5208) and [RFC5958](https://tools.ietf.org/html/rfc5958). It can handle both unencrypted PKCS#8 PrivateKeyInfo format and EncryptedPrivateKeyInfo format with PKCS#5 (v2.0) algorithms.


[**Godoc**](http://godoc.org/github.com/youmark/pkcs8)

## Installation
Supports Go 1.10+. Release v1.1 is the last release supporting Go 1.9 

```text
go get github.com/youmark/pkcs8
```
## dependency
This package depends on golang.org/x/crypto/pbkdf2 and golang.org/x/crypto/scrypt packages. Use the following command to retrieve them
```text
go get golang.org/x/crypto/pbkdf2
go get golang.org/x/crypto/scrypt
```

