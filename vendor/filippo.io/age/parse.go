// Copyright 2021 The age Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package age

import (
	"bufio"
	"fmt"
	"io"
	"strings"
)

// ParseIdentities parses a file with one or more private key encodings, one per
// line. Empty lines and lines starting with "#" are ignored.
//
// This is the same syntax as the private key files accepted by the CLI, except
// the CLI also accepts SSH private keys, which are not recommended for the
// average application.
//
// Currently, all returned values are of type *X25519Identity, but different
// types might be returned in the future.
func ParseIdentities(f io.Reader) ([]Identity, error) {
	const privateKeySizeLimit = 1 << 24 // 16 MiB
	var ids []Identity
	scanner := bufio.NewScanner(io.LimitReader(f, privateKeySizeLimit))
	var n int
	for scanner.Scan() {
		n++
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		i, err := ParseX25519Identity(line)
		if err != nil {
			return nil, fmt.Errorf("error at line %d: %v", n, err)
		}
		ids = append(ids, i)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read secret keys file: %v", err)
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("no secret keys found")
	}
	return ids, nil
}

// ParseRecipients parses a file with one or more public key encodings, one per
// line. Empty lines and lines starting with "#" are ignored.
//
// This is the same syntax as the recipients files accepted by the CLI, except
// the CLI also accepts SSH recipients, which are not recommended for the
// average application.
//
// Currently, all returned values are of type *X25519Recipient, but different
// types might be returned in the future.
func ParseRecipients(f io.Reader) ([]Recipient, error) {
	const recipientFileSizeLimit = 1 << 24 // 16 MiB
	var recs []Recipient
	scanner := bufio.NewScanner(io.LimitReader(f, recipientFileSizeLimit))
	var n int
	for scanner.Scan() {
		n++
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		r, err := ParseX25519Recipient(line)
		if err != nil {
			// Hide the error since it might unintentionally leak the contents
			// of confidential files.
			return nil, fmt.Errorf("malformed recipient at line %d", n)
		}
		recs = append(recs, r)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read recipients file: %v", err)
	}
	if len(recs) == 0 {
		return nil, fmt.Errorf("no recipients found")
	}
	return recs, nil
}
