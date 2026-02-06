package pac

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/jcmturner/gokrb5/v8/crypto"
	"github.com/jcmturner/gokrb5/v8/iana/keyusage"
	"github.com/jcmturner/gokrb5/v8/types"
	"github.com/jcmturner/rpc/v2/mstypes"
	"github.com/jcmturner/rpc/v2/ndr"
)

// https://msdn.microsoft.com/en-us/library/cc237931.aspx

// CredentialsInfo implements https://msdn.microsoft.com/en-us/library/cc237953.aspx
type CredentialsInfo struct {
	Version                    uint32 // A 32-bit unsigned integer in little-endian format that defines the version. MUST be 0x00000000.
	EType                      uint32
	PACCredentialDataEncrypted []byte // Key usage number for encryption: KERB_NON_KERB_SALT (16)
	PACCredentialData          CredentialData
}

// Unmarshal bytes into the CredentialsInfo struct
func (c *CredentialsInfo) Unmarshal(b []byte, k types.EncryptionKey) (err error) {
	//The CredentialsInfo structure is a simple structure that is not NDR-encoded.
	r := mstypes.NewReader(bytes.NewReader(b))

	c.Version, err = r.Uint32()
	if err != nil {
		return
	}
	if c.Version != 0 {
		err = errors.New("credentials info version is not zero")
		return
	}
	c.EType, err = r.Uint32()
	if err != nil {
		return
	}
	c.PACCredentialDataEncrypted, err = r.ReadBytes(len(b) - 8)
	if err != nil {
		err = fmt.Errorf("error reading PAC Credetials Data: %v", err)
		return
	}

	err = c.DecryptEncPart(k)
	if err != nil {
		err = fmt.Errorf("error decrypting PAC Credentials Data: %v", err)
		return
	}
	return
}

// DecryptEncPart decrypts the encrypted part of the CredentialsInfo.
func (c *CredentialsInfo) DecryptEncPart(k types.EncryptionKey) error {
	if k.KeyType != int32(c.EType) {
		return fmt.Errorf("key provided is not the correct type. Type needed: %d, type provided: %d", c.EType, k.KeyType)
	}
	pt, err := crypto.DecryptMessage(c.PACCredentialDataEncrypted, k, keyusage.KERB_NON_KERB_SALT)
	if err != nil {
		return err
	}
	err = c.PACCredentialData.Unmarshal(pt)
	if err != nil {
		return err
	}
	return nil
}

// CredentialData implements https://msdn.microsoft.com/en-us/library/cc237952.aspx
type CredentialData struct {
	CredentialCount uint32
	Credentials     []SECPKGSupplementalCred // Size is the value of CredentialCount
}

// Unmarshal converts the bytes provided into a CredentialData type.
func (c *CredentialData) Unmarshal(b []byte) (err error) {
	dec := ndr.NewDecoder(bytes.NewReader(b))
	err = dec.Decode(c)
	if err != nil {
		err = fmt.Errorf("error unmarshaling KerbValidationInfo: %v", err)
	}
	return
}
