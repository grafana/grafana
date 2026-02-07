// Copyright 2020 CUE Authors
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

package runtime

import (
	"sync"

	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
)

func (r *Runtime) IndexToString(i int64) string {
	return r.index.IndexToString(i)
}

func (r *Runtime) StringToIndex(s string) int64 {
	return getKey(s)
}

func (r *Runtime) NextUniqueID() uint64 {
	return r.index.getNextUniqueID()
}

func (r *Runtime) LabelStr(l adt.Feature) string {
	return l.IdentString(r)
}

func (r *Runtime) StrLabel(str string) adt.Feature {
	return r.Label(str, false)
}

func (r *Runtime) Label(s string, isIdent bool) adt.Feature {
	index := r.StringToIndex(s)
	typ := adt.StringLabel
	if isIdent {
		switch {
		case internal.IsDef(s) && internal.IsHidden(s):
			typ = adt.HiddenDefinitionLabel
		case internal.IsDef(s):
			typ = adt.DefinitionLabel
		case internal.IsHidden(s):
			typ = adt.HiddenLabel
		}
	}
	f, _ := adt.MakeLabel(nil, index, typ)
	return f
}

// TODO: move to Runtime as fields.
var (
	labelMap = map[string]int{}
	labels   = make([]string, 0, 1000)
	mutex    sync.RWMutex
)

func init() {
	// Ensure label 0 is assigned to _.
	getKey("_")
}

func getKey(s string) int64 {
	mutex.RLock()
	p, ok := labelMap[s]
	mutex.RUnlock()
	if ok {
		return int64(p)
	}
	mutex.Lock()
	defer mutex.Unlock()
	p, ok = labelMap[s]
	if ok {
		return int64(p)
	}
	p = len(labels)
	labels = append(labels, s)
	labelMap[s] = p
	return int64(p)
}

func (x *index) IndexToString(i int64) string {
	mutex.RLock()
	s := labels[i]
	mutex.RUnlock()
	return s
}
