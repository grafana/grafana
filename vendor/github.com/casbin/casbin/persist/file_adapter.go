// Copyright 2017 The casbin Authors. All Rights Reserved.
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

package persist

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"os"
	"strings"

	"github.com/casbin/casbin/model"
	"github.com/casbin/casbin/util"
)

// FileAdapter represents the file adapter for policy persistence, can load policy from file or save policy to file.
type FileAdapter struct {
	filePath string
}

// NewFileAdapter is the constructor for FileAdapter.
func NewFileAdapter(filePath string) *FileAdapter {
	a := FileAdapter{}
	a.filePath = filePath
	return &a
}

// LoadPolicy loads policy from file.
func (a *FileAdapter) LoadPolicy(model model.Model) error {
	if a.filePath == "" {
		return errors.New("Invalid file path, file path cannot be empty")
	}

	err := a.loadPolicyFile(model, loadPolicyLine)
	if err != nil {
		return err
	}
	return nil
}

// SavePolicy saves policy to file.
func (a *FileAdapter) SavePolicy(model model.Model) error {
	if a.filePath == "" {
		return errors.New("Invalid file path, file path cannot be empty")
	}

	var tmp bytes.Buffer

	for ptype, ast := range model["p"] {
		for _, rule := range ast.Policy {
			tmp.WriteString(ptype + ", ")
			tmp.WriteString(util.ArrayToString(rule))
			tmp.WriteString("\n")
		}
	}

	for ptype, ast := range model["g"] {
		for _, rule := range ast.Policy {
			tmp.WriteString(ptype + ", ")
			tmp.WriteString(util.ArrayToString(rule))
			tmp.WriteString("\n")
		}
	}

	err := a.savePolicyFile(strings.TrimRight(tmp.String(), "\n"))
	if err != nil {
		return err
	}
	return nil
}

func (a *FileAdapter) loadPolicyFile(model model.Model, handler func(string, model.Model)) error {
	f, err := os.Open(a.filePath)
	if err != nil {
		return err
	}
	buf := bufio.NewReader(f)
	for {
		line, err := buf.ReadString('\n')
		line = strings.TrimSpace(line)
		handler(line, model)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
	}
}

func (a *FileAdapter) savePolicyFile(text string) error {
	f, err := os.Create(a.filePath)
	if err != nil {
		return err
	}
	w := bufio.NewWriter(f)
	w.WriteString(text)
	w.Flush()
	f.Close()
	return nil
}
