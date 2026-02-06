package azblob

import (
	"net"
	"net/url"
	"strings"
)

const (
	snapshot           = "snapshot"
	versionId          = "versionid"
	SnapshotTimeFormat = "2006-01-02T15:04:05.0000000Z07:00"
)

// A BlobURLParts object represents the components that make up an Azure Storage Container/Blob URL. You parse an
// existing URL into its parts by calling NewBlobURLParts(). You construct a URL from parts by calling URL().
// NOTE: Changing any SAS-related field requires computing a new SAS signature.
type BlobURLParts struct {
	Scheme              string // Ex: "https://"
	Host                string // Ex: "account.blob.core.windows.net", "10.132.141.33", "10.132.141.33:80"
	IPEndpointStyleInfo IPEndpointStyleInfo
	ContainerName       string // "" if no container
	BlobName            string // "" if no blob
	Snapshot            string // "" if not a snapshot
	SAS                 SASQueryParameters
	UnparsedParams      string
	VersionID           string // "" if not versioning enabled
}

// IPEndpointStyleInfo is used for IP endpoint style URL when working with Azure storage emulator.
// Ex: "https://10.132.141.33/accountname/containername"
type IPEndpointStyleInfo struct {
	AccountName string // "" if not using IP endpoint style
}

// isIPEndpointStyle checkes if URL's host is IP, in this case the storage account endpoint will be composed as:
// http(s)://IP(:port)/storageaccount/container/...
// As url's Host property, host could be both host or host:port
func isIPEndpointStyle(host string) bool {
	if host == "" {
		return false
	}
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	// For IPv6, there could be case where SplitHostPort fails for cannot finding port.
	// In this case, eliminate the '[' and ']' in the URL.
	// For details about IPv6 URL, please refer to https://tools.ietf.org/html/rfc2732
	if host[0] == '[' && host[len(host)-1] == ']' {
		host = host[1 : len(host)-1]
	}
	return net.ParseIP(host) != nil
}

// NewBlobURLParts parses a URL initializing BlobURLParts' fields including any SAS-related & snapshot query parameters. Any other
// query parameters remain in the UnparsedParams field. This method overwrites all fields in the BlobURLParts object.
func NewBlobURLParts(u url.URL) BlobURLParts {
	up := BlobURLParts{
		Scheme: u.Scheme,
		Host:   u.Host,
	}

	// Find the container & blob names (if any)
	if u.Path != "" {
		path := u.Path
		if path[0] == '/' {
			path = path[1:] // If path starts with a slash, remove it
		}
		if isIPEndpointStyle(up.Host) {
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
	paramsMap := u.Query()

	up.Snapshot = ""  // Assume no snapshot
	up.VersionID = "" // Assume no versionID
	if snapshotStr, ok := caseInsensitiveValues(paramsMap).Get(snapshot); ok {
		up.Snapshot = snapshotStr[0]
		// If we recognized the query parameter, remove it from the map
		delete(paramsMap, snapshot)
	}

	if versionIDs, ok := caseInsensitiveValues(paramsMap).Get(versionId); ok {
		up.VersionID = versionIDs[0]
		// If we recognized the query parameter, remove it from the map
		delete(paramsMap, versionId)   // delete "versionid" from paramsMap
		delete(paramsMap, "versionId") // delete "versionId" from paramsMap
	}
	up.SAS = newSASQueryParameters(paramsMap, true)
	up.UnparsedParams = paramsMap.Encode()
	return up
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

// URL returns a URL object whose fields are initialized from the BlobURLParts fields. The URL's RawQuery
// field contains the SAS, snapshot, and unparsed query parameters.
func (up BlobURLParts) URL() url.URL {
	path := ""
	if isIPEndpointStyle(up.Host) && up.IPEndpointStyleInfo.AccountName != "" {
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

	//If no snapshot is initially provided, fill it in from the SAS query properties to help the user
	if up.Snapshot == "" && !up.SAS.snapshotTime.IsZero() {
		up.Snapshot = up.SAS.snapshotTime.Format(SnapshotTimeFormat)
	}

	// Concatenate blob snapshot query parameter (if it exists)
	if up.Snapshot != "" {
		if len(rawQuery) > 0 {
			rawQuery += "&"
		}
		rawQuery += snapshot + "=" + up.Snapshot
	}

	// Concatenate blob version id query parameter (if it exists)
	if up.VersionID != "" {
		if len(rawQuery) > 0 {
			rawQuery += "&"
		}
		rawQuery += versionId + "=" + up.VersionID
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
	return u
}
