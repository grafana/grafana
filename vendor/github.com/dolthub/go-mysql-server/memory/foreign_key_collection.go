// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package memory

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

// ForeignKeyCollection is a shareable container for a collection of foreign keys.
type ForeignKeyCollection struct {
	fks []sql.ForeignKeyConstraint
}

// newForeignKeyCollection returns a new ForeignKeyCollection.
func newForeignKeyCollection() *ForeignKeyCollection {
	return &ForeignKeyCollection{}
}

// AddFK adds the given foreign key to the internal slice.
func (fkc *ForeignKeyCollection) AddFK(fk sql.ForeignKeyConstraint) {
	if fkc == nil {
		return
	}
	fkc.fks = append(fkc.fks, fk)
}

// DropFK removes the given foreign key from the internal slice. Returns true if the foreign key was found.
func (fkc *ForeignKeyCollection) DropFK(fkName string) bool {
	if fkc == nil {
		return false
	}
	fkLowerName := strings.ToLower(fkName)
	for i, existingFk := range fkc.fks {
		if fkLowerName == strings.ToLower(existingFk.Name) {
			fkc.fks = append(fkc.fks[:i], fkc.fks[i+1:]...)
			return true
		}
	}
	return false
}

// SetResolved sets the given foreign key as being resolved.
func (fkc *ForeignKeyCollection) SetResolved(fkName string) bool {
	if fkc == nil {
		return false
	}
	fkLowerName := strings.ToLower(fkName)
	for i, existingFk := range fkc.fks {
		if fkLowerName == strings.ToLower(existingFk.Name) {
			fkc.fks[i].IsResolved = true
			return true
		}
	}
	return false
}

// Keys returns all of the foreign keys.
func (fkc *ForeignKeyCollection) Keys() []sql.ForeignKeyConstraint {
	if fkc == nil {
		return nil
	}
	return fkc.fks
}
