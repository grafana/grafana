// Copyright 2020 the authors.
//
// Licensed under the Apache License, Version 2.0 (the LICENSE-APACHE file) or
// the MIT license (the LICENSE-MIT file) at your option. This file may not be
// copied, modified, or distributed except according to those terms.

// Package acl implements POSIX.1e draft 17-compliant
// manipulation of access control lists (ACLs).
// See the acl manpage for details: http://linux.die.net/man/5/acl
//
// Currently, only Linux is supported. On systems which
// are not supported, all calls will return the error
// syscall.ENOTSUP.
package acl

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

// ACL represents an access control list as defined
// in the POSIX.1e draft standard. If an ACL is not
// valid (see the IsValid method), the behavior of
// the functions and methods of this package is
// undefined.
type ACL []Entry

// FromUnix generates an ACL equivalent to the given
// unix permissions bitmask. All non-permission bits
// in perms are ignored.
func FromUnix(perms os.FileMode) ACL {
	return ACL{
		{Tag: TagUserObj, Perms: (perms >> 6) & 7},
		{Tag: TagGroupObj, Perms: (perms >> 3) & 7},
		{Tag: TagOther, Perms: perms & 7},
	}
}

// ToUnix returns the unix permissions bitmask
// encoded by a. If a is not valid as defined
// by a.IsValid, the behavior of ToUnix is
// undefined.
func ToUnix(a ACL) os.FileMode {
	var perms os.FileMode
	for _, e := range a {
		switch e.Tag {
		case TagUserObj:
			perms |= (e.perms() << 6)
		case TagGroupObj:
			perms |= (e.perms() << 3)
		case TagOther:
			perms |= e.perms()
		}
	}
	return perms
}

// IsValid returns whether a is a valid ACL as defined
// by the POSIX.1e draft standard.
//
// Specifically, a valid ACL must conform to the following
// rules:
//  - it contains exactly one entry each with the tag TagUserObj, TagGroupObj, and TagOther
//  - it may contain zero or more entries with the tags TagUser or TagGroup
//  - if it contains any entries with the tag TagUser or TagGroup, it must contain exactly one
//    entry with the tag TagMask; otherwise, such an entry is optional (there can be zero or one)
//  - all qualifiers must be unique among entries of the same tag type (TagUser or TagGroup)
func (a ACL) IsValid() bool {
	var numUserObj, numGroupObj, numOther int
	var numMask, numUserOrGroup int
	users := make(map[string]bool)
	groups := make(map[string]bool)
	for _, e := range a {
		switch e.Tag {
		case TagUserObj:
			numUserObj++
		case TagGroupObj:
			numGroupObj++
		case TagOther:
			numOther++
		case TagMask:
			numMask++
		case TagUser:
			numUserOrGroup++
			if users[e.Qualifier] {
				return false
			}
			users[e.Qualifier] = true
		case TagGroup:
			numUserOrGroup++
			if groups[e.Qualifier] {
				return false
			}
			groups[e.Qualifier] = true
		default:
			return false
		}
	}
	switch {
	case numUserObj != 1:
		return false
	case numGroupObj != 1:
		return false
	case numOther != 1:
		return false
	case numUserOrGroup > 0 && numMask == 0:
		return false
	case numMask > 1:
		return false
	}
	return true
}

// String implements the POSIX.1e short text form.
// For example:
//  u::rwx,g::r-x,o::---,u:dvader:r--,m::r--
// This output is produced by an ACL in which the file owner
// has read, write, and execute; the file group has read and
// execute; other has no permissions; the user dvader has
// read; and the mask is read.
func (a ACL) String() string {
	strs := make([]string, len(a))
	for i, e := range a {
		strs[i] = e.String()
	}
	return strings.Join(strs, ",")
}

// StringLong implements the POSIX.1e long text form.
// The long text form of the example given above is:
//  user::rwx
//  group::r-x
//  other::---
//  user:dvader:r--
//  mask::r--
func (a ACL) StringLong() string {
	lines := make([]string, len(a))
	mask := os.FileMode(7)
	for _, e := range a {
		if e.Tag == TagMask {
			mask = e.perms()
			break
		}
	}
	for i, e := range a {
		if (e.Tag == TagUser || e.Tag == TagGroupObj || e.Tag == TagGroup) &&
			mask|e.perms() != mask {
			effective := mask & e.perms()
			lines[i] = fmt.Sprintf("%-20s#effective:%s", e.StringLong(), permString(effective))
		} else {
			lines[i] = e.StringLong()
		}
	}
	return strings.Join(lines, "\n")
}

// Tag is the type of an ACL entry tag.
type Tag tag

const (
	TagUserObj  Tag = tagUserObj  // Permissions of the file owner
	TagUser         = tagUser     // Permissions of a specified user
	TagGroupObj     = tagGroupObj // Permissions of the file group
	TagGroup        = tagGroup    // Permissions of a specified group

	// Maximum allowed access rights of any entry
	// with the tag TagUser, TagGroupObj, or TagGroup
	TagMask  = tagMask
	TagOther = tagOther // Permissions of a process not matching any other entry
)

// String implements the POSIX.1e short text form.
func (t Tag) String() string {
	switch t {
	case TagUser, TagUserObj:
		return "u"
	case TagGroup, TagGroupObj:
		return "g"
	case TagOther:
		return "o"
	case TagMask:
		return "m"
	default:
		// TODO(joshlf): what to do in this case?
		return "?" // non-standard, but not specified in POSIX.1e
	}
}

// StringLong implements the POSIX.1e long text form.
func (t Tag) StringLong() string {
	switch t {
	case TagUser, TagUserObj:
		return "user"
	case TagGroup, TagGroupObj:
		return "group"
	case TagOther:
		return "other"
	case TagMask:
		return "mask"
	default:
		// TODO(joshlf): what to do in this case?
		return "????" // non-standard, but not specified in POSIX.1e
	}
}

// Entry represents an entry in an ACL.
type Entry struct {
	Tag Tag

	// TODO(joshlf): it would be nice if we could handle
	// the UID/user name or GID/group name transition
	// transparently under the hood rather than pushing
	// the responsibility to the user. However, there are
	// some subtle considerations:
	//   - It must be valid to provide a UID/GID for a
	//     user or group that does not exist (setfactl
	//     supports this)
	//   - If the qualifier can be either a UID/GID or
	//     a user name/group name, there should probably
	//     be a better way of encoding it (that is,
	//     better than just setting it to one or the
	//     other and letting the user implement custom
	//     logic to tell the difference)

	// The Qualifier specifies what entity (user or group)
	// this entry applies to. If the Tag is TagUser, it is
	// a UID; if the Tag is TagGroup, it is a GID; otherwise
	// the field is ignored. Note that the qualifier must
	// be a UID or GID - it cannot be, for example, a user name.
	Qualifier string

	// ACL permissions are taken from a traditional rwx
	// (read/write/execute) permissions vector. The Perms
	// field stores these as the lowest three bits -
	// the bits in any higher positions are ignored.
	Perms os.FileMode
}

// Use e.perms() to make sure that only
// the lowest three bits are set - some
// algorithms may inadvertently break
// otherwise (including libacl itself).
func (e Entry) perms() os.FileMode { return 7 & e.Perms }

var permStrings = []string{
	0: "---",
	1: "--x",
	2: "-w-",
	3: "-wx",
	4: "r--",
	5: "r-x",
	6: "rw-",
	7: "rwx",
}

// assumes perm has only lowest three bits set
func permString(perm os.FileMode) string {
	return permStrings[int(perm)]
}

// String implements the POSIX.1e short text form.
func (e Entry) String() string {
	middle := "::"
	if e.Tag == TagUser || e.Tag == TagGroup {
		middle = ":" + formatQualifier(e.Qualifier, e.Tag) + ":"
	}
	return fmt.Sprintf("%s%s%s", e.Tag, middle, permString(e.perms()))
}

// StringLong implements the POSIX.1e long text form.
func (e Entry) StringLong() string {
	middle := "::"
	if e.Tag == TagUser || e.Tag == TagGroup {
		middle = ":" + formatQualifier(e.Qualifier, e.Tag) + ":"
	}
	return fmt.Sprintf("%s%s%s", e.Tag.StringLong(), middle, permString(e.perms()))
}

// overwrite in other files to implement platform-specific behavior
var formatQualifier = func(q string, tag Tag) string { return q }

// Get retrieves the access ACL associated with path,
// returning any error encountered.
func Get(path string) (ACL, error) {
	return get(path)
}

// FGet retrieves the access ACL associated with an *os.File,
// returning any error encountered.
func FGet(f *os.File) (ACL, error) {
	return fget(f)
}

// GetDefault retrieves the default ACL associated with path,
// returning any error encountered.
func GetDefault(path string) (ACL, error) {
	return getDefault(path)
}

// FGetDefault retrieves the default ACL associated with an *os.File,
// returning any error encountered.
func FGetDefault(f *os.File) (ACL, error) {
	return fgetDefault(f)
}

// Set sets the access ACL on path,
// returning any error encountered.
func Set(path string, acl ACL) error {
	if !acl.IsValid() {
		return fmt.Errorf("invalid ACL")
	}
	return set(path, acl)
}

// FSet sets the access ACL on an *os.File,
// returning any error encountered.
func FSet(f *os.File, acl ACL) error {
	if !acl.IsValid() {
		return fmt.Errorf("invalid ACL")
	}
	return fset(f, acl)
}

// SetDefault sets the default ACL on path,
// returning any error encountered.
func SetDefault(path string, acl ACL) error {
	if !acl.IsValid() {
		return fmt.Errorf("invalid ACL")
	}
	return setDefault(path, acl)
}

// FSetDefault sets the default ACL on an *os.File,
// returning any error encountered.
func FSetDefault(f *os.File, acl ACL) error {
	if !acl.IsValid() {
		return fmt.Errorf("invalid ACL")
	}
	return fsetDefault(f, acl)
}

func add(oldACL ACL, entries ...Entry) (newACL ACL, err error) {
	var (
		addUserGroup bool // entries contains TagUser or TagGroup element
		addMask      bool // entries contains TagMask element
	)
	for _, e := range entries {
		switch e.Tag {
		case TagUser, TagGroup:
			addUserGroup = true
		case TagMask:
			addMask = true
		}
	}

	// put all of the entries into a map: first the
	// old entries, and then the new ones (so that
	// new entries overwrite old entries)
	type key struct {
		Tag       Tag
		Qualifier string
	}
	m := make(map[key]Entry)
	for _, e := range oldACL {
		// we can rely on e.Qualifier to be the
		// empty string if e.Tag is neither TagUser
		// nor TagGroup (see the implementation of
		// get in acl_impl.go)
		m[key{e.Tag, e.Qualifier}] = e
	}
	for _, e := range entries {
		// the user could have passed an entry
		// whose Qualifier field was spuriously
		// non-empty; clean their input in case
		// this happened
		tag := e.Tag
		qual := e.Qualifier
		if tag != TagUser && tag != TagGroup {
			qual = ""
		}
		m[key{tag, qual}] = e
	}

	if addUserGroup && !addMask {
		// automatically add mask entry;
		// calculate its permissions to
		// be the union of all TagUser and
		// TagGroup permissions (see the
		// doc comment on this function)
		var mperms os.FileMode
		for _, e := range m {
			switch e.Tag {
			case TagUser, TagGroup, TagGroupObj:
				mperms |= e.Perms
			}
		}
		m[key{Tag: TagMask}] = Entry{Tag: TagMask, Perms: mperms}
	}

	for _, e := range m {
		newACL = append(newACL, e)
	}
	if !newACL.IsValid() {
		return newACL, errors.New("add results in invalid ACL")
	}
	return
}

// TODO(joshlf): It seems as though the mask also
// affects entries with the tag TagGroupObj, so
// when calculating the new mask, its bits should
// be taken into account as well.

// Add adds the given entries to the ACL on path.
// Any matching entries that exist on the file
// will be overwritten. Two entries match if they
// have the same tag (and, if that tag is TagUser
// or TagGroup, they also have the same qualifier).
//
// In order to ensure that the new ACL is valid,
// after being calculated from the old ACL and the
// new entries, the new ACL is modified as follows:
// If the ACL includes named user or group entries
// (with the tags TagUser or TagGroup) but no mask
// entry, a mask entry is added. This entry's
// permissions are the union of all permissions
// affected by the entry (namely, all entries with
// the tags TagUser, TagGroup, or TagGroupObj).
func Add(path string, entries ...Entry) error {
	oldACL, err := get(path)
	if err != nil {
		return err
	}
	newACL, err := add(oldACL, entries...)
	if err != nil {
		return err
	}
	return set(path, newACL)
}

// FAdd adds the given entries to the ACL like Add, but on an *os.File
func FAdd(f *os.File, entries ...Entry) error {
	oldACL, err := fget(f)
	if err != nil {
		return err
	}
	newACL, err := add(oldACL, entries...)
	if err != nil {
		return err
	}
	return fset(f, newACL)
}
