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
	"strings"

	"github.com/casbin/casbin/model"
)

func loadPolicyLine(line string, model model.Model) {
	if line == "" {
		return
	}

	if strings.HasPrefix(line, "#") {
		return
	}

	tokens := strings.Split(line, ", ")

	key := tokens[0]
	sec := key[:1]
	model[sec][key].Policy = append(model[sec][key].Policy, tokens[1:])
}

// Adapter represents the abstract adapter interface for policy persistence.
// FileAdapter, DBAdapter inherits this interface.
type Adapter interface {
	LoadPolicy(model model.Model) error
	SavePolicy(model model.Model) error
}
