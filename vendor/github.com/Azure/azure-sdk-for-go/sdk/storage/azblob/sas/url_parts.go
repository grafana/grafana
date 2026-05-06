//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package sas

import (
	"net/url"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
)

const (
	snapshot  = "snapshot"
	versionId = "versionid"
)

// IPEndpointStyleInfo is used for IP endpoint style URL when working with Azure storage emulator.
// Ex: "https://10.132.141.33/accountname/containername"
type IPEndpointStyleInfo struct {
	AccountName string // "" if not using IP endpoint style
}

// URLParts object represents the components that make up an Azure Storage Container/Blob URL.
// NOTE: Changing any SAS-related field requires computing a new SAS signature.
type URLParts struct {
	Scheme              string // Ex: "https://"
	Host                string // Ex: "account.blob.core.windows.net", "10.132.141.33", "10.132.141.33:80"
	IPEndpointStyleInfo IPEndpointStyleInfo
	ContainerName       string // "" if no container
	BlobName            string // "" if no blob
	Snapshot            string // "" if not a snapshot
	SAS                 QueryParameters
	UnparsedParams      string
	VersionID           string // "" if not versioning enabled
}

// ParseURL parses a URL initializing URLParts' fields including any SAS-related & snapshot query parameters.
// Any other query parameters remain in the UnparsedParams field.
func ParseURL(u string) (URLParts, error) {
	uri, err := url.Parse(u)
	if err != nil {
		return URLParts{}, err
	}

	up := URLParts{
		Scheme: uri.Scheme,
		Host:   uri.Host,
	}

	// Find the container & blob names (if any)
	if uri.Path != "" {
		path := uri.Path
		if path[0] == '/' {
			path = path[1:] // If path starts with a slash, remove it
		}
		if shared.IsIPEndpointStyle(up.Host) {
			if accountEndIndex := strings.Index(path, "/"); accountEndIndex == -1 { // Slash not found; path has account name & no container name or blob
				up.IPEndpointStyleInfo.AccountName = path
				path = "" // No ContainerName present in the URL so path should be empty
			} else {
				up.IPEndpointStyleInfo.AccountName = path[:accountEndIndex] // The account name is the part between the slashes
				path = path[accountEndIndex+1:]                             // path refers to portion after the account name now (container & blob names)
			}
		}

		containerEndIndex := strings.Index(path, "/") // Find the next slash (if it exists)
		if containerEndIndex == -1 {                  // Slash not found; path has container name & no blob name
			up.ContainerName = path
		} else {
			up.ContainerName = path[:containerEndIndex] // The container name is the part between the slashes
			up.BlobName = path[containerEndIndex+1:]    // The blob name is after the container slash
		}
	}

	// Convert the query parameters to a case-sensitive map & trim whitespace
	paramsMap := uri.Query()

	up.Snapshot = "" // Assume no snapshot
	if snapshotStr, ok := caseInsensitiveValues(paramsMap).Get(snapshot); ok {
		up.Snapshot = snapshotStr[0]
		// If we recognized the query parameter, remove it from the map
		delete(paramsMap, snapshot)
	}

	up.VersionID = "" // Assume no versionID
	if versionIDs, ok := caseInsensitiveValues(paramsMap).Get(versionId); ok {
		up.VersionID = versionIDs[0]
		// If we recognized the query parameter, remove it from the map
		delete(paramsMap, versionId)   // delete "versionid" from paramsMap
		delete(paramsMap, "versionId") // delete "versionId" from paramsMap
	}

	up.SAS = NewQueryParameters(paramsMap, true)
	up.UnparsedParams = paramsMap.Encode()
	return up, nil
}

// String returns a URL object whose fields are initialized from the URLParts fields. The URL's RawQuery
// field contains the SAS, snapshot, and unparsed query parameters.
func (up URLParts) String() string {
	path := ""
	if shared.IsIPEndpointStyle(up.Host) && up.IPEndpointStyleInfo.AccountName != "" {
		path += "/" + up.IPEndpointStyleInfo.AccountName
	}
	// Concatenate container & blob names (if they exist)
	if up.ContainerName != "" {
		path += "/" + up.ContainerName
		if up.BlobName != "" {
			path += "/" + up.BlobName
		}
	}

	rawQuery := up.UnparsedParams

	// If no snapshot is initially provided, fill it in from the SAS query properties to help the user
	if up.Snapshot == "" && !up.SAS.SnapshotTime().IsZero() {
		up.Snapshot = up.SAS.SnapshotTime().Format(exported.SnapshotTimeFormat)
	}

	// Concatenate blob version id query parameter (if it exists)
	if up.VersionID != "" {
		if len(rawQuery) > 0 {
			rawQuery += "&"
		}
		rawQuery += versionId + "=" + up.VersionID
	}

	// Concatenate blob snapshot query parameter (if it exists)
	if up.Snapshot != "" {
		if len(rawQuery) > 0 {
			rawQuery += "&"
		}
		rawQuery += snapshot + "=" + up.Snapshot
	}
	sas := up.SAS.Encode()
	if sas != "" {
		if len(rawQuery) > 0 {
			rawQuery += "&"
		}
		rawQuery += sas
	}
	u := url.URL{
		Scheme:   up.Scheme,
		Host:     up.Host,
		Path:     path,
		RawQuery: rawQuery,
	}
	return u.String()
}

type caseInsensitiveValues url.Values // map[string][]string

func (values caseInsensitiveValues) Get(key string) ([]string, bool) {
	key = strings.ToLower(key)
	for k, v := range values {
		if strings.ToLower(k) == key {
			return v, true
		}
	}
	return []string{}, false
}
