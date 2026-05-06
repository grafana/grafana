// Copyright 2019 The age Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package age implements file encryption according to the age-encryption.org/v1
// specification.
//
// For most use cases, use the Encrypt and Decrypt functions with
// X25519Recipient and X25519Identity. If passphrase encryption is required, use
// ScryptRecipient and ScryptIdentity. For compatibility with existing SSH keys
// use the filippo.io/age/agessh package.
//
// age encrypted files are binary and not malleable. For encoding them as text,
// use the filippo.io/age/armor package.
//
// # Key management
//
// age does not have a global keyring. Instead, since age keys are small,
// textual, and cheap, you are encouraged to generate dedicated keys for each
// task and application.
//
// Recipient public keys can be passed around as command line flags and in
// config files, while secret keys should be stored in dedicated files, through
// secret management systems, or as environment variables.
//
// There is no default path for age keys. Instead, they should be stored at
// application-specific paths. The CLI supports files where private keys are
// listed one per line, ignoring empty lines and lines starting with "#". These
// files can be parsed with ParseIdentities.
//
// When integrating age into a new system, it's recommended that you only
// support X25519 keys, and not SSH keys. The latter are supported for manual
// encryption operations. If you need to tie into existing key management
// infrastructure, you might want to consider implementing your own Recipient
// and Identity.
//
// # Backwards compatibility
//
// Files encrypted with a stable version (not alpha, beta, or release candidate)
// of age, or with any v1.0.0 beta or release candidate, will decrypt with any
// later versions of the v1 API. This might change in v2, in which case v1 will
// be maintained with security fixes for compatibility with older files.
//
// If decrypting an older file poses a security risk, doing so might require an
// explicit opt-in in the API.
package age

import (
	"crypto/hmac"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"sort"

	"filippo.io/age/internal/format"
	"filippo.io/age/internal/stream"
)

// An Identity is passed to Decrypt to unwrap an opaque file key from a
// recipient stanza. It can be for example a secret key like X25519Identity, a
// plugin, or a custom implementation.
//
// Unwrap must return an error wrapping ErrIncorrectIdentity if none of the
// recipient stanzas match the identity, any other error will be considered
// fatal.
//
// Most age API users won't need to interact with this directly, and should
// instead pass Recipient implementations to Encrypt and Identity
// implementations to Decrypt.
type Identity interface {
	Unwrap(stanzas []*Stanza) (fileKey []byte, err error)
}

var ErrIncorrectIdentity = errors.New("incorrect identity for recipient block")

// A Recipient is passed to Encrypt to wrap an opaque file key to one or more
// recipient stanza(s). It can be for example a public key like X25519Recipient,
// a plugin, or a custom implementation.
//
// Most age API users won't need to interact with this directly, and should
// instead pass Recipient implementations to Encrypt and Identity
// implementations to Decrypt.
type Recipient interface {
	Wrap(fileKey []byte) ([]*Stanza, error)
}

// RecipientWithLabels can be optionally implemented by a Recipient, in which
// case Encrypt will use WrapWithLabels instead of Wrap.
//
// Encrypt will succeed only if the labels returned by all the recipients
// (assuming the empty set for those that don't implement RecipientWithLabels)
// are the same.
//
// This can be used to ensure a recipient is only used with other recipients
// with equivalent properties (for example by setting a "postquantum" label) or
// to ensure a recipient is always used alone (by returning a random label, for
// example to preserve its authentication properties).
type RecipientWithLabels interface {
	WrapWithLabels(fileKey []byte) (s []*Stanza, labels []string, err error)
}

// A Stanza is a section of the age header that encapsulates the file key as
// encrypted to a specific recipient.
//
// Most age API users won't need to interact with this directly, and should
// instead pass Recipient implementations to Encrypt and Identity
// implementations to Decrypt.
type Stanza struct {
	Type string
	Args []string
	Body []byte
}

const fileKeySize = 16
const streamNonceSize = 16

// Encrypt encrypts a file to one or more recipients.
//
// Writes to the returned WriteCloser are encrypted and written to dst as an age
// file. Every recipient will be able to decrypt the file.
//
// The caller must call Close on the WriteCloser when done for the last chunk to
// be encrypted and flushed to dst.
func Encrypt(dst io.Writer, recipients ...Recipient) (io.WriteCloser, error) {
	if len(recipients) == 0 {
		return nil, errors.New("no recipients specified")
	}

	fileKey := make([]byte, fileKeySize)
	if _, err := rand.Read(fileKey); err != nil {
		return nil, err
	}

	hdr := &format.Header{}
	var labels []string
	for i, r := range recipients {
		stanzas, l, err := wrapWithLabels(r, fileKey)
		if err != nil {
			return nil, fmt.Errorf("failed to wrap key for recipient #%d: %v", i, err)
		}
		sort.Strings(l)
		if i == 0 {
			labels = l
		} else if !slicesEqual(labels, l) {
			return nil, fmt.Errorf("incompatible recipients")
		}
		for _, s := range stanzas {
			hdr.Recipients = append(hdr.Recipients, (*format.Stanza)(s))
		}
	}
	if mac, err := headerMAC(fileKey, hdr); err != nil {
		return nil, fmt.Errorf("failed to compute header MAC: %v", err)
	} else {
		hdr.MAC = mac
	}
	if err := hdr.Marshal(dst); err != nil {
		return nil, fmt.Errorf("failed to write header: %v", err)
	}

	nonce := make([]byte, streamNonceSize)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	if _, err := dst.Write(nonce); err != nil {
		return nil, fmt.Errorf("failed to write nonce: %v", err)
	}

	return stream.NewWriter(streamKey(fileKey, nonce), dst)
}

func wrapWithLabels(r Recipient, fileKey []byte) (s []*Stanza, labels []string, err error) {
	if r, ok := r.(RecipientWithLabels); ok {
		return r.WrapWithLabels(fileKey)
	}
	s, err = r.Wrap(fileKey)
	return
}

func slicesEqual(s1, s2 []string) bool {
	if len(s1) != len(s2) {
		return false
	}
	for i := range s1 {
		if s1[i] != s2[i] {
			return false
		}
	}
	return true
}

// NoIdentityMatchError is returned by Decrypt when none of the supplied
// identities match the encrypted file.
type NoIdentityMatchError struct {
	// Errors is a slice of all the errors returned to Decrypt by the Unwrap
	// calls it made. They all wrap ErrIncorrectIdentity.
	Errors []error
}

func (*NoIdentityMatchError) Error() string {
	return "no identity matched any of the recipients"
}

// Decrypt decrypts a file encrypted to one or more identities.
//
// It returns a Reader reading the decrypted plaintext of the age file read
// from src. All identities will be tried until one successfully decrypts the file.
func Decrypt(src io.Reader, identities ...Identity) (io.Reader, error) {
	if len(identities) == 0 {
		return nil, errors.New("no identities specified")
	}

	hdr, payload, err := format.Parse(src)
	if err != nil {
		return nil, fmt.Errorf("failed to read header: %w", err)
	}

	stanzas := make([]*Stanza, 0, len(hdr.Recipients))
	for _, s := range hdr.Recipients {
		stanzas = append(stanzas, (*Stanza)(s))
	}
	errNoMatch := &NoIdentityMatchError{}
	var fileKey []byte
	for _, id := range identities {
		fileKey, err = id.Unwrap(stanzas)
		if errors.Is(err, ErrIncorrectIdentity) {
			errNoMatch.Errors = append(errNoMatch.Errors, err)
			continue
		}
		if err != nil {
			return nil, err
		}

		break
	}
	if fileKey == nil {
		return nil, errNoMatch
	}

	if mac, err := headerMAC(fileKey, hdr); err != nil {
		return nil, fmt.Errorf("failed to compute header MAC: %v", err)
	} else if !hmac.Equal(mac, hdr.MAC) {
		return nil, errors.New("bad header MAC")
	}

	nonce := make([]byte, streamNonceSize)
	if _, err := io.ReadFull(payload, nonce); err != nil {
		return nil, fmt.Errorf("failed to read nonce: %w", err)
	}

	return stream.NewReader(streamKey(fileKey, nonce), payload)
}

// multiUnwrap is a helper that implements Identity.Unwrap in terms of a
// function that unwraps a single recipient stanza.
func multiUnwrap(unwrap func(*Stanza) ([]byte, error), stanzas []*Stanza) ([]byte, error) {
	for _, s := range stanzas {
		fileKey, err := unwrap(s)
		if errors.Is(err, ErrIncorrectIdentity) {
			// If we ever start returning something interesting wrapping
			// ErrIncorrectIdentity, we should let it make its way up through
			// Decrypt into NoIdentityMatchError.Errors.
			continue
		}
		if err != nil {
			return nil, err
		}
		return fileKey, nil
	}
	return nil, ErrIncorrectIdentity
}
