// Copyright 2020 the authors.
//
// Licensed under the Apache License, Version 2.0 (the LICENSE-APACHE file) or
// the MIT license (the LICENSE-MIT file) at your option. This file may not be
// copied, modified, or distributed except according to those terms.

// +build go1.9

package acl

import "os/user"

func init() {
	formatQualifier = func(q string, tag Tag) string {
		switch tag {
		case TagUser:
			usr, err := user.LookupId(q)
			if err != nil {
				return q
			}
			return usr.Username
		case TagGroup:
			grp, err := user.LookupGroupId(q)
			if err != nil {
				return q
			}
			return grp.Name
		default:
			return q
		}
	}
}
