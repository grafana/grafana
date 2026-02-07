// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"regexp"
)

// sudoPaths is a map containing the paths that require a token's policy
// to have the "sudo" capability. The keys are the paths as strings, in
// the same format as they are returned by the OpenAPI spec. The values
// are the regular expressions that can be used to test whether a given
// path matches that path or not (useful specifically for the paths that
// contain templated fields.)
var sudoPaths = map[string]*regexp.Regexp{
	"/auth/token/accessors":                         regexp.MustCompile(`^/auth/token/accessors/?$`),
	"/auth/token/revoke-orphan":                     regexp.MustCompile(`^/auth/token/revoke-orphan$`),
	"/pki/root":                                     regexp.MustCompile(`^/pki/root$`),
	"/pki/root/sign-self-issued":                    regexp.MustCompile(`^/pki/root/sign-self-issued$`),
	"/sys/audit":                                    regexp.MustCompile(`^/sys/audit$`),
	"/sys/audit/{path}":                             regexp.MustCompile(`^/sys/audit/.+$`),
	"/sys/auth/{path}":                              regexp.MustCompile(`^/sys/auth/.+$`),
	"/sys/auth/{path}/tune":                         regexp.MustCompile(`^/sys/auth/.+/tune$`),
	"/sys/config/auditing/request-headers":          regexp.MustCompile(`^/sys/config/auditing/request-headers$`),
	"/sys/config/auditing/request-headers/{header}": regexp.MustCompile(`^/sys/config/auditing/request-headers/.+$`),
	"/sys/config/cors":                              regexp.MustCompile(`^/sys/config/cors$`),
	"/sys/config/ui/headers":                        regexp.MustCompile(`^/sys/config/ui/headers/?$`),
	"/sys/config/ui/headers/{header}":               regexp.MustCompile(`^/sys/config/ui/headers/.+$`),
	"/sys/internal/inspect/router/{tag}":            regexp.MustCompile(`^/sys/internal/inspect/router/.+$`),
	"/sys/internal/counters/activity/export":        regexp.MustCompile(`^/sys/internal/counters/activity/export$`),
	"/sys/leases":                                   regexp.MustCompile(`^/sys/leases$`),
	// This entry is a bit wrong... sys/leases/lookup does NOT require sudo. But sys/leases/lookup/ with a trailing
	// slash DOES require sudo. But the part of the Vault CLI that uses this logic doesn't pass operation-appropriate
	// trailing slashes, it always strips them off, so we end up giving the wrong answer for one of these.
	"/sys/leases/lookup/{prefix}":                 regexp.MustCompile(`^/sys/leases/lookup(?:/.+)?$`),
	"/sys/leases/revoke-force/{prefix}":           regexp.MustCompile(`^/sys/leases/revoke-force/.+$`),
	"/sys/leases/revoke-prefix/{prefix}":          regexp.MustCompile(`^/sys/leases/revoke-prefix/.+$`),
	"/sys/plugins/catalog/{name}":                 regexp.MustCompile(`^/sys/plugins/catalog/[^/]+$`),
	"/sys/plugins/catalog/{type}":                 regexp.MustCompile(`^/sys/plugins/catalog/[\w-]+$`),
	"/sys/plugins/catalog/{type}/{name}":          regexp.MustCompile(`^/sys/plugins/catalog/[\w-]+/[^/]+$`),
	"/sys/plugins/runtimes/catalog":               regexp.MustCompile(`^/sys/plugins/runtimes/catalog/?$`),
	"/sys/plugins/runtimes/catalog/{type}/{name}": regexp.MustCompile(`^/sys/plugins/runtimes/catalog/[\w-]+/[^/]+$`),
	"/sys/raw/{path}":                             regexp.MustCompile(`^/sys/raw(?:/.+)?$`),
	"/sys/remount":                                regexp.MustCompile(`^/sys/remount$`),
	"/sys/revoke-force/{prefix}":                  regexp.MustCompile(`^/sys/revoke-force/.+$`),
	"/sys/revoke-prefix/{prefix}":                 regexp.MustCompile(`^/sys/revoke-prefix/.+$`),
	"/sys/rotate":                                 regexp.MustCompile(`^/sys/rotate$`),
	"/sys/seal":                                   regexp.MustCompile(`^/sys/seal$`),
	"/sys/step-down":                              regexp.MustCompile(`^/sys/step-down$`),

	// enterprise-only paths
	"/sys/replication/dr/primary/secondary-token":          regexp.MustCompile(`^/sys/replication/dr/primary/secondary-token$`),
	"/sys/replication/performance/primary/secondary-token": regexp.MustCompile(`^/sys/replication/performance/primary/secondary-token$`),
	"/sys/replication/primary/secondary-token":             regexp.MustCompile(`^/sys/replication/primary/secondary-token$`),
	"/sys/replication/reindex":                             regexp.MustCompile(`^/sys/replication/reindex$`),
	"/sys/storage/raft/snapshot-auto/config":               regexp.MustCompile(`^/sys/storage/raft/snapshot-auto/config/?$`),
	"/sys/storage/raft/snapshot-auto/config/{name}":        regexp.MustCompile(`^/sys/storage/raft/snapshot-auto/config/[^/]+$`),
}

func SudoPaths() map[string]*regexp.Regexp {
	return sudoPaths
}

// Determine whether the given path requires the sudo capability.
// Note that this uses hardcoded static path information, so will return incorrect results for paths in namespaces,
// or for secret engines mounted at non-default paths.
// Expects to receive a path with an initial slash, but no trailing slashes, as the Vault CLI (the only known and
// expected user of this function) sanitizes its paths that way.
func IsSudoPath(path string) bool {
	// Return early if the path is any of the non-templated sudo paths.
	if _, ok := sudoPaths[path]; ok {
		return true
	}

	// Some sudo paths have templated fields in them.
	// (e.g. /sys/revoke-prefix/{prefix})
	// The values in the sudoPaths map are actually regular expressions,
	// so we can check if our path matches against them.
	for _, sudoPathRegexp := range sudoPaths {
		match := sudoPathRegexp.MatchString(path)
		if match {
			return true
		}
	}

	return false
}
