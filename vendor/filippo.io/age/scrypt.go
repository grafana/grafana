// Copyright 2019 The age Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package age

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strconv"

	"filippo.io/age/internal/format"
	"golang.org/x/crypto/chacha20poly1305"
	"golang.org/x/crypto/scrypt"
)

const scryptLabel = "age-encryption.org/v1/scrypt"

// ScryptRecipient is a password-based recipient. Anyone with the password can
// decrypt the message.
//
// If a ScryptRecipient is used, it must be the only recipient for the file: it
// can't be mixed with other recipient types and can't be used multiple times
// for the same file.
//
// Its use is not recommended for automated systems, which should prefer
// X25519Recipient.
type ScryptRecipient struct {
	password   []byte
	workFactor int
}

var _ Recipient = &ScryptRecipient{}

// NewScryptRecipient returns a new ScryptRecipient with the provided password.
func NewScryptRecipient(password string) (*ScryptRecipient, error) {
	if len(password) == 0 {
		return nil, errors.New("passphrase can't be empty")
	}
	r := &ScryptRecipient{
		password: []byte(password),
		// TODO: automatically scale this to 1s (with a min) in the CLI.
		workFactor: 18, // 1s on a modern machine
	}
	return r, nil
}

// SetWorkFactor sets the scrypt work factor to 2^logN.
// It must be called before Wrap.
//
// If SetWorkFactor is not called, a reasonable default is used.
func (r *ScryptRecipient) SetWorkFactor(logN int) {
	if logN > 30 || logN < 1 {
		panic("age: SetWorkFactor called with illegal value")
	}
	r.workFactor = logN
}

const scryptSaltSize = 16

func (r *ScryptRecipient) Wrap(fileKey []byte) ([]*Stanza, error) {
	salt := make([]byte, scryptSaltSize)
	if _, err := rand.Read(salt[:]); err != nil {
		return nil, err
	}

	logN := r.workFactor
	l := &Stanza{
		Type: "scrypt",
		Args: []string{format.EncodeToString(salt), strconv.Itoa(logN)},
	}

	salt = append([]byte(scryptLabel), salt...)
	k, err := scrypt.Key(r.password, salt, 1<<logN, 8, 1, chacha20poly1305.KeySize)
	if err != nil {
		return nil, fmt.Errorf("failed to generate scrypt hash: %v", err)
	}

	wrappedKey, err := aeadEncrypt(k, fileKey)
	if err != nil {
		return nil, err
	}
	l.Body = wrappedKey

	return []*Stanza{l}, nil
}

// WrapWithLabels implements [age.RecipientWithLabels], returning a random
// label. This ensures a ScryptRecipient can't be mixed with other recipients
// (including other ScryptRecipients).
//
// Users reasonably expect files encrypted to a passphrase to be [authenticated]
// by that passphrase, i.e. for it to be impossible to produce a file that
// decrypts successfully with a passphrase without knowing it. If a file is
// encrypted to other recipients, those parties can produce different files that
// would break that expectation.
//
// [authenticated]: https://words.filippo.io/dispatches/age-authentication/
func (r *ScryptRecipient) WrapWithLabels(fileKey []byte) (stanzas []*Stanza, labels []string, err error) {
	stanzas, err = r.Wrap(fileKey)

	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return nil, nil, err
	}
	labels = []string{hex.EncodeToString(random)}

	return
}

// ScryptIdentity is a password-based identity.
type ScryptIdentity struct {
	password      []byte
	maxWorkFactor int
}

var _ Identity = &ScryptIdentity{}

// NewScryptIdentity returns a new ScryptIdentity with the provided password.
func NewScryptIdentity(password string) (*ScryptIdentity, error) {
	if len(password) == 0 {
		return nil, errors.New("passphrase can't be empty")
	}
	i := &ScryptIdentity{
		password:      []byte(password),
		maxWorkFactor: 22, // 15s on a modern machine
	}
	return i, nil
}

// SetMaxWorkFactor sets the maximum accepted scrypt work factor to 2^logN.
// It must be called before Unwrap.
//
// This caps the amount of work that Decrypt might have to do to process
// received files. If SetMaxWorkFactor is not called, a fairly high default is
// used, which might not be suitable for systems processing untrusted files.
func (i *ScryptIdentity) SetMaxWorkFactor(logN int) {
	if logN > 30 || logN < 1 {
		panic("age: SetMaxWorkFactor called with illegal value")
	}
	i.maxWorkFactor = logN
}

func (i *ScryptIdentity) Unwrap(stanzas []*Stanza) ([]byte, error) {
	for _, s := range stanzas {
		if s.Type == "scrypt" && len(stanzas) != 1 {
			return nil, errors.New("an scrypt recipient must be the only one")
		}
	}
	return multiUnwrap(i.unwrap, stanzas)
}

var digitsRe = regexp.MustCompile(`^[1-9][0-9]*$`)

func (i *ScryptIdentity) unwrap(block *Stanza) ([]byte, error) {
	if block.Type != "scrypt" {
		return nil, ErrIncorrectIdentity
	}
	if len(block.Args) != 2 {
		return nil, errors.New("invalid scrypt recipient block")
	}
	salt, err := format.DecodeString(block.Args[0])
	if err != nil {
		return nil, fmt.Errorf("failed to parse scrypt salt: %v", err)
	}
	if len(salt) != scryptSaltSize {
		return nil, errors.New("invalid scrypt recipient block")
	}
	if w := block.Args[1]; !digitsRe.MatchString(w) {
		return nil, fmt.Errorf("scrypt work factor encoding invalid: %q", w)
	}
	logN, err := strconv.Atoi(block.Args[1])
	if err != nil {
		return nil, fmt.Errorf("failed to parse scrypt work factor: %v", err)
	}
	if logN > i.maxWorkFactor {
		return nil, fmt.Errorf("scrypt work factor too large: %v", logN)
	}
	if logN <= 0 { // unreachable
		return nil, fmt.Errorf("invalid scrypt work factor: %v", logN)
	}

	salt = append([]byte(scryptLabel), salt...)
	k, err := scrypt.Key(i.password, salt, 1<<logN, 8, 1, chacha20poly1305.KeySize)
	if err != nil { // unreachable
		return nil, fmt.Errorf("failed to generate scrypt hash: %v", err)
	}

	// This AEAD is not robust, so an attacker could craft a message that
	// decrypts under two different keys (meaning two different passphrases) and
	// then use an error side-channel in an online decryption oracle to learn if
	// either key is correct. This is deemed acceptable because the use case (an
	// online decryption oracle) is not recommended, and the security loss is
	// only one bit. This also does not bypass any scrypt work, although that work
	// can be precomputed in an online oracle scenario.
	fileKey, err := aeadDecrypt(k, fileKeySize, block.Body)
	if err == errIncorrectCiphertextSize {
		return nil, errors.New("invalid scrypt recipient block: incorrect file key size")
	} else if err != nil {
		return nil, ErrIncorrectIdentity
	}
	return fileKey, nil
}
