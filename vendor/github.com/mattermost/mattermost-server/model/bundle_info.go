// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type BundleInfo struct {
	Path string

	Manifest      *Manifest
	ManifestPath  string
	ManifestError error
}

// Returns bundle info for the given path. The return value is never nil.
func BundleInfoForPath(path string) *BundleInfo {
	m, mpath, err := FindManifest(path)
	return &BundleInfo{
		Path:          path,
		Manifest:      m,
		ManifestPath:  mpath,
		ManifestError: err,
	}
}
