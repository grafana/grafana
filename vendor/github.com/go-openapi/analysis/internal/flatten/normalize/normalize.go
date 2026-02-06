// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package normalize

import (
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-openapi/spec"
)

// RebaseRef rebases a remote ref relative to a base ref.
//
// NOTE: does not support JSONschema ID for $ref (we assume we are working with swagger specs here).
//
// NOTE(windows):
// * refs are assumed to have been normalized with drive letter lower cased (from go-openapi/spec)
// * "/ in paths may appear as escape sequences
func RebaseRef(baseRef string, ref string) string {
	baseRef, _ = url.PathUnescape(baseRef)
	ref, _ = url.PathUnescape(ref)

	if baseRef == "" || baseRef == "." || strings.HasPrefix(baseRef, "#") {
		return ref
	}

	parts := strings.Split(ref, "#")

	baseParts := strings.Split(baseRef, "#")
	baseURL, _ := url.Parse(baseParts[0])
	if strings.HasPrefix(ref, "#") {
		if baseURL.Host == "" {
			return strings.Join([]string{baseParts[0], parts[1]}, "#")
		}

		return strings.Join([]string{baseParts[0], parts[1]}, "#")
	}

	refURL, _ := url.Parse(parts[0])
	if refURL.Host != "" || filepath.IsAbs(parts[0]) {
		// not rebasing an absolute path
		return ref
	}

	// there is a relative path
	var basePath string
	if baseURL.Host != "" {
		// when there is a host, standard URI rules apply (with "/")
		baseURL.Path = path.Dir(baseURL.Path)
		baseURL.Path = path.Join(baseURL.Path, "/"+parts[0])

		return baseURL.String()
	}

	// this is a local relative path
	// basePart[0] and parts[0] are local filesystem directories/files
	basePath = filepath.Dir(baseParts[0])
	relPath := filepath.Join(basePath, string(filepath.Separator)+parts[0])
	if len(parts) > 1 {
		return strings.Join([]string{relPath, parts[1]}, "#")
	}

	return relPath
}

// Path renders absolute path on remote file refs
//
// NOTE(windows):
// * refs are assumed to have been normalized with drive letter lower cased (from go-openapi/spec)
// * "/ in paths may appear as escape sequences
func Path(ref spec.Ref, basePath string) string {
	uri, _ := url.PathUnescape(ref.String())
	if ref.HasFragmentOnly || filepath.IsAbs(uri) {
		return uri
	}

	refURL, _ := url.Parse(uri)
	if refURL.Host != "" {
		return uri
	}

	parts := strings.Split(uri, "#")
	// BasePath, parts[0] are local filesystem directories, guaranteed to be absolute at this stage
	parts[0] = filepath.Join(filepath.Dir(basePath), parts[0])

	return strings.Join(parts, "#")
}
