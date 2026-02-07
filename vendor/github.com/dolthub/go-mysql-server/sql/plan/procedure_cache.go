// Copyright 2021 Dolthub, Inc.
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

package plan

import (
	"math"
	"sort"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

// ProcedureCache contains all non-built-in stored procedures for each database.
type ProcedureCache struct {
	dbToProcedureMap map[string]map[string]map[int]*Procedure
	IsPopulating     bool
}

// NewProcedureCache returns a *ProcedureCache.
func NewProcedureCache() *ProcedureCache {
	return &ProcedureCache{
		dbToProcedureMap: make(map[string]map[string]map[int]*Procedure),
		IsPopulating:     false,
	}
}

// Get returns the stored procedure with the given name from the given database. All names are case-insensitive. If the
// procedure does not exist, then this returns nil. If the number of parameters do not match any given procedure, then
// returns the procedure with the largest number of parameters.
func (pc *ProcedureCache) Get(dbName, procedureName string, numOfParams int) *Procedure {
	dbName = strings.ToLower(dbName)
	procedureName = strings.ToLower(procedureName)
	if procMap, ok := pc.dbToProcedureMap[dbName]; ok {
		if procedures, ok := procMap[procedureName]; ok {
			if procedure, ok := procedures[numOfParams]; ok {
				return procedure
			}

			var largestParamLen int
			var largestParamProc *Procedure
			for _, procedure := range procedures {
				paramLen := len(procedure.Params)
				if procedure.HasVariadicParameter() {
					paramLen = math.MaxInt
				}
				if largestParamProc == nil || largestParamLen < paramLen {
					largestParamProc = procedure
					largestParamLen = paramLen
				}
			}
			return largestParamProc
		}
	}
	return nil
}

// AllForDatabase returns all stored procedures for the given database, sorted by name and parameter count
// ascending. The database name is case-insensitive.
func (pc *ProcedureCache) AllForDatabase(dbName string) []*Procedure {
	dbName = strings.ToLower(dbName)
	var proceduresForDb []*Procedure
	if procMap, ok := pc.dbToProcedureMap[dbName]; ok {
		for _, procedures := range procMap {
			for _, procedure := range procedures {
				proceduresForDb = append(proceduresForDb, procedure)
			}
		}
		sort.Slice(proceduresForDb, func(i, j int) bool {
			if proceduresForDb[i].Name != proceduresForDb[j].Name {
				return proceduresForDb[i].Name < proceduresForDb[j].Name
			}
			return len(proceduresForDb[i].Params) < len(proceduresForDb[j].Params)
		})
	}
	return proceduresForDb
}

// Register adds the given stored procedure to the cache. Will overwrite any procedures that already exist with the
// same name and same number of parameters for the given database name.
func (pc *ProcedureCache) Register(dbName string, procedure *Procedure) error {
	dbName = strings.ToLower(dbName)
	paramLen := len(procedure.Params)
	if procedure.HasVariadicParameter() {
		paramLen = math.MaxInt
	}
	if procMap, ok := pc.dbToProcedureMap[dbName]; ok {
		if procedures, ok := procMap[strings.ToLower(procedure.Name)]; ok {
			if _, ok := procedures[paramLen]; ok {
				return sql.ErrExternalProcedureAmbiguousOverload.New(procedure.Name, paramLen)
			}
			procedures[paramLen] = procedure
		} else {
			procMap[strings.ToLower(procedure.Name)] = map[int]*Procedure{paramLen: procedure}
		}
	} else {
		pc.dbToProcedureMap[dbName] = map[string]map[int]*Procedure{strings.ToLower(procedure.Name): {paramLen: procedure}}
	}
	return nil
}
