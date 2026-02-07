// Copyright 2018 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fileblob

import (
	"encoding/json"
	"fmt"
	"os"
)

const attrsExt = ".attrs"

var errAttrsExt = fmt.Errorf("file extension %q is reserved", attrsExt)

// xattrs stores extended attributes for an object. The format is like
// filesystem extended attributes, see
// https://www.freedesktop.org/wiki/CommonExtendedAttributes.
type xattrs struct {
	CacheControl       string            `json:"user.cache_control"`
	ContentDisposition string            `json:"user.content_disposition"`
	ContentEncoding    string            `json:"user.content_encoding"`
	ContentLanguage    string            `json:"user.content_language"`
	ContentType        string            `json:"user.content_type"`
	Metadata           map[string]string `json:"user.metadata"`
	MD5                []byte            `json:"md5"`
}

// setAttrs creates a "path.attrs" file along with blob to store the attributes,
// it uses JSON format.
func setAttrs(path string, xa xattrs) error {
	f, err := os.Create(path + attrsExt)
	if err != nil {
		return err
	}
	if err := json.NewEncoder(f).Encode(xa); err != nil {
		f.Close()
		os.Remove(f.Name())
		return err
	}
	return f.Close()
}

// getAttrs looks at the "path.attrs" file to retrieve the attributes and
// decodes them into a xattrs struct. It doesn't return error when there is no
// such .attrs file.
func getAttrs(path string) (xattrs, error) {
	f, err := os.Open(path + attrsExt)
	if err != nil {
		if os.IsNotExist(err) {
			// Handle gracefully for non-existent .attr files.
			return xattrs{
				ContentType: "application/octet-stream",
			}, nil
		}
		return xattrs{}, err
	}
	xa := new(xattrs)
	if err := json.NewDecoder(f).Decode(xa); err != nil {
		f.Close()
		return xattrs{}, err
	}
	return *xa, f.Close()
}
