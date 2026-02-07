// Copyright 2020 the authors.
//
// Licensed under the Apache License, Version 2.0 (the LICENSE-APACHE file) or
// the MIT license (the LICENSE-MIT file) at your option. This file may not be
// copied, modified, or distributed except according to those terms.

// +build !linux

package acl

import (
	"os"
	"syscall"
)

type tag int

const (
	// While these aren't actually meaningful,
	// we still want them to be distinct so they
	// don't compare as equal
	tagUndefined Tag = iota
	tagUserObj
	tagUser
	tagGroupObj
	tagGroup
	tagMask
	tagOther
)

func get(path string) (ACL, error) {
	return nil, syscall.ENOTSUP
}

func fget(f *os.File) (ACL, error) {
	return nil, syscall.ENOTSUP
}

func getDefault(path string) (ACL, error) {
	return nil, syscall.ENOTSUP
}

func fgetDefault(f *os.File) (ACL, error) {
	return nil, syscall.ENOTSUP
}

func set(path string, acl ACL) error {
	return syscall.ENOTSUP
}

func fset(f *os.File, acl ACL) error {
	return syscall.ENOTSUP
}

func setDefault(path string, acl ACL) error {
	return syscall.ENOTSUP
}

func fsetDefault(f *os.File, acl ACL) error {
	return syscall.ENOTSUP
}
