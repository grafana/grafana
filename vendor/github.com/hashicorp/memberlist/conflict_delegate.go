// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package memberlist

// ConflictDelegate is a used to inform a client that
// a node has attempted to join which would result in a
// name conflict. This happens if two clients are configured
// with the same name but different addresses.
type ConflictDelegate interface {
	// NotifyConflict is invoked when a name conflict is detected
	NotifyConflict(existing, other *Node)
}
