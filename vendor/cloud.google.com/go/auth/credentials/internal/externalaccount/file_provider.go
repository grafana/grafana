// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package externalaccount

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"cloud.google.com/go/auth/internal"
	"cloud.google.com/go/auth/internal/credsfile"
)

const (
	fileProviderType = "file"
)

type fileSubjectProvider struct {
	File   string
	Format *credsfile.Format
}

func (sp *fileSubjectProvider) subjectToken(context.Context) (string, error) {
	tokenFile, err := os.Open(sp.File)
	if err != nil {
		return "", fmt.Errorf("credentials: failed to open credential file %q: %w", sp.File, err)
	}
	defer tokenFile.Close()
	tokenBytes, err := internal.ReadAll(tokenFile)
	if err != nil {
		return "", fmt.Errorf("credentials: failed to read credential file: %w", err)
	}
	tokenBytes = bytes.TrimSpace(tokenBytes)

	if sp.Format == nil {
		return string(tokenBytes), nil
	}
	switch sp.Format.Type {
	case fileTypeJSON:
		jsonData := make(map[string]interface{})
		err = json.Unmarshal(tokenBytes, &jsonData)
		if err != nil {
			return "", fmt.Errorf("credentials: failed to unmarshal subject token file: %w", err)
		}
		val, ok := jsonData[sp.Format.SubjectTokenFieldName]
		if !ok {
			return "", errors.New("credentials: provided subject_token_field_name not found in credentials")
		}
		token, ok := val.(string)
		if !ok {
			return "", errors.New("credentials: improperly formatted subject token")
		}
		return token, nil
	case fileTypeText:
		return string(tokenBytes), nil
	default:
		return "", errors.New("credentials: invalid credential_source file format type: " + sp.Format.Type)
	}
}

func (sp *fileSubjectProvider) providerType() string {
	return fileProviderType
}
