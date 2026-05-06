package pkcs8

import (
	"encoding/asn1"

	"golang.org/x/crypto/scrypt"
)

var (
	oidScrypt = asn1.ObjectIdentifier{1, 3, 6, 1, 4, 1, 11591, 4, 11}
)

func init() {
	RegisterKDF(oidScrypt, func() KDFParameters {
		return new(scryptParams)
	})
}

type scryptParams struct {
	Salt                     []byte
	CostParameter            int
	BlockSize                int
	ParallelizationParameter int
}

func (p scryptParams) DeriveKey(password []byte, size int) (key []byte, err error) {
	return scrypt.Key(password, p.Salt, p.CostParameter, p.BlockSize,
		p.ParallelizationParameter, size)
}

// ScryptOpts contains options for the scrypt key derivation function.
type ScryptOpts struct {
	SaltSize                 int
	CostParameter            int
	BlockSize                int
	ParallelizationParameter int
}

func (p ScryptOpts) DeriveKey(password, salt []byte, size int) (
	key []byte, params KDFParameters, err error) {

	key, err = scrypt.Key(password, salt, p.CostParameter, p.BlockSize,
		p.ParallelizationParameter, size)
	if err != nil {
		return nil, nil, err
	}
	params = scryptParams{
		BlockSize:                p.BlockSize,
		CostParameter:            p.CostParameter,
		ParallelizationParameter: p.ParallelizationParameter,
		Salt:                     salt,
	}
	return key, params, nil
}

func (p ScryptOpts) GetSaltSize() int {
	return p.SaltSize
}

func (p ScryptOpts) OID() asn1.ObjectIdentifier {
	return oidScrypt
}
