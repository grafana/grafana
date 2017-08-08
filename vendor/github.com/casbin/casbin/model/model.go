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

package model

import (
	"strconv"
	"strings"

	"github.com/casbin/casbin/config"
	"github.com/casbin/casbin/util"
)

// Model represents the whole access control model.
type Model map[string]AssertionMap

// AssertionMap is the collection of assertions, can be "r", "p", "g", "e", "m".
type AssertionMap map[string]*Assertion

var sectionNameMap = map[string]string{
	"r": "request_definition",
	"p": "policy_definition",
	"g": "role_definition",
	"e": "policy_effect",
	"m": "matchers",
}

func loadAssertion(model Model, cfg config.ConfigInterface, sec string, key string) bool {
	value := cfg.String(sectionNameMap[sec] + "::" + key)
	return model.AddAssertion(sec, key, value)
}

func (model Model) AddAssertion(sec string, key string, value string) bool {
	ast := Assertion{}
	ast.Key = key
	ast.Value = value

	if ast.Value == "" {
		return false
	}

	if sec == "r" || sec == "p" {
		ast.Tokens = strings.Split(ast.Value, ", ")
		for i := range ast.Tokens {
			ast.Tokens[i] = key + "_" + ast.Tokens[i]
		}
	} else {
		ast.Value = util.RemoveComments(util.EscapeAssertion(ast.Value))
	}

	_, ok := model[sec]
	if !ok {
		model[sec] = make(AssertionMap)
	}

	model[sec][key] = &ast
	return true
}

func getKeySuffix(i int) string {
	if i == 1 {
		return ""
	}

	return strconv.Itoa(i)
}

func loadSection(model Model, cfg config.ConfigInterface, sec string) {
	i := 1
	for {
		if !loadAssertion(model, cfg, sec, sec+getKeySuffix(i)) {
			break
		} else {
			i++
		}
	}
}

// LoadModel loads the model from model CONF file.
func LoadModel(path string) Model {
	cfg, err := config.NewConfig(path)
	if err != nil {
		panic(err)
	}

	model := make(Model)

	loadSection(model, cfg, "r")
	loadSection(model, cfg, "p")
	loadSection(model, cfg, "e")
	loadSection(model, cfg, "m")

	loadSection(model, cfg, "g")

	return model
}

// PrintModel prints the model to the log.
func (model Model) PrintModel() {
	util.LogPrint("Model:")
	for k, v := range model {
		for i, j := range v {
			util.LogPrintf("%s.%s: %s", k, i, j.Value)
		}
	}
}
