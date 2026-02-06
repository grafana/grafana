package xmlenc

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"

	"github.com/beevik/etree"
)

var testKey = func() *rsa.PrivateKey {
	const keyStr = `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDkXTUsWzRVpUHjbDpWCfYDfXmQ/q4LkaioZoTpu4ut1Q3eQC5t
gD14agJhgT8yzeY5S/YNlwCyuVkjuFyoyTHFX2IOPpz7jnh4KnQ+B1IH9fY/+kmk
zHJgxSUDJsdUMPgGpKt5hnEn7ziXAWXLc2udFbnHwhi9TXXwRHGi9wZ4YwIDAQAB
AoGBALNTnlXeqRI4W61DZ+v4ln/XIIeD9xiOoWrcVrNU2zL+g41ryQmkEqFkXcpD
vGUg2xFTXTz+v0WZ1y39sIW6uKFRYUfaNsF6iVfGAyx1VWK/jgtPnCWDQy26Eby0
BqpbZRy1a6MLYVEG/5bvZE01CDV4XttpTrNX91WWcYGduJxBAkEA6ED1ZOqIzBpu
c2KAo+bWmroCH8+cSDk0gVq6bnRB+EEhRCmo/VgvndWLxfexdGmDIOAIisB06N5a
GzBSCaEY/QJBAPu2cNvuuBNLwrlxPCwOEpIHYT4gJq8UMtg6O6N+u++nYCGhK6uo
VCmrKY+UewyNIcsLZF0jsNI2qJjiU1vQxN8CQQDfQJnigMQwlfO3/Ga1po6Buu2R
0IpkroB3G1R8GkrTrR+iGv2zUdKrwHsUOC2fPlFrB4+OeMOomRw6aG9jjDStAkB1
ztiZhuvuVAoKIv5HnDqC0CNqIUAZtzlozDB3f+xT6SFr+/Plfn4Nlod4JMVGhZNo
ZaeOlBLBAEX+cAcVtOs/AkBicZOAPv84ABmFfyhXhYaAuacaJLq//jg+t+URUOg+
XZS9naRmawEQxOkZQVoMeKgvu05+V4MniFqdQBINIkr5
-----END RSA PRIVATE KEY-----`
	b, _ := pem.Decode([]byte(keyStr))
	k, err := x509.ParsePKCS1PrivateKey(b.Bytes)
	if err != nil {
		panic(err)
	}
	return k
}()

// Fuzz is the go-fuzz fuzzing function
func Fuzz(data []byte) int {
	doc := etree.NewDocument()
	if err := doc.ReadFromBytes(data); err != nil {
		return 0
	}
	if doc.Root() == nil {
		return 0
	}

	if _, err := Decrypt(testKey, doc.Root()); err != nil {
		return 0
	}
	return 1
}
