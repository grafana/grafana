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

package casbin

import (
	"fmt"
	"reflect"
	"strconv"

	"github.com/Knetic/govaluate"
	"github.com/casbin/casbin/model"
	"github.com/casbin/casbin/persist"
	"github.com/casbin/casbin/util"
)

// Effect is the result for a policy rule.
type Effect int

const (
	EFFECT_ALLOW Effect = iota
	EFFECT_INDETERMINATE
	EFFECT_DENY
)

// Enforcer is the main interface for authorization enforcement and policy management.
type Enforcer struct {
	modelPath string
	model     model.Model
	fm        model.FunctionMap

	adapter persist.Adapter

	enabled bool
}

// NewEnforcer gets an enforcer via CONF, file or DB.
// e := NewEnforcer("path/to/casbin.conf")
// e := NewEnforcer("path/to/basic_model.conf", "path/to/basic_policy.conf")
// e := NewEnforcer("path/to/rbac_model.conf", "mysql", "root:@tcp(127.0.0.1:3306)/")
func NewEnforcer(params ...interface{}) *Enforcer {
	e := &Enforcer{}

	parsedParamLen := 0
	if len(params) >= 1 && reflect.TypeOf(params[len(params) - 1]).Kind() == reflect.Bool {
		enableLog := params[len(params) - 1].(bool)
		e.EnableLog(enableLog)

		parsedParamLen ++
	}

	if len(params) - parsedParamLen == 2 {
		if reflect.TypeOf(params[1]).Kind() == reflect.String {
			e.InitWithFile(params[0].(string), params[1].(string))
		} else {
			e.InitWithAdapter(params[0].(string), params[1].(persist.Adapter))
		}
	} else if len(params) - parsedParamLen == 1 {
		e.InitWithFile(params[0].(string), "")
	} else if len(params) - parsedParamLen == 0 {
		e.InitWithFile("", "")
	} else {
		panic("Invalid parameters for enforcer.")
	}

	return e
}

// InitWithFile initializes an enforcer with a model file and a policy file.
func (e *Enforcer) InitWithFile(modelPath string, policyPath string) {
	e.modelPath = modelPath

	e.adapter = persist.NewFileAdapter(policyPath)

	e.enabled = true

	if e.modelPath != "" {
		e.LoadModel()
		e.LoadPolicy()
	}
}

// InitWithAdapter initializes an enforcer with a database adapter.
func (e *Enforcer) InitWithAdapter(modelPath string, adapter persist.Adapter) {
	e.modelPath = modelPath

	e.adapter = adapter

	e.enabled = true

	e.LoadModel()
	e.LoadPolicy()
}

// LoadModel reloads the model from the model CONF file.
// Because the policy is attached to a model, so the policy is invalidated and needs to be reloaded by calling LoadPolicy().
func (e *Enforcer) LoadModel() {
	e.model = model.LoadModel(e.modelPath)
	e.model.PrintModel()
	e.fm = model.LoadFunctionMap()
}

// GetModel gets the current model.
func (e *Enforcer) GetModel() model.Model {
	return e.model
}

// SetModel sets the current model.
func (e *Enforcer) SetModel(model model.Model) {
	e.model = model
}

// ClearPolicy clears all policy.
func (e *Enforcer) ClearPolicy() {
	e.model.ClearPolicy()
}

// LoadPolicy reloads the policy from file/database.
func (e *Enforcer) LoadPolicy() {
	e.model.ClearPolicy()
	e.adapter.LoadPolicy(e.model)

	e.model.PrintPolicy()

	e.model.BuildRoleLinks()
}

// SavePolicy saves the current policy (usually after changed with casbin API) back to file/database.
func (e *Enforcer) SavePolicy() {
	e.adapter.SavePolicy(e.model)
}

// Enable changes the enforcing state of casbin, when casbin is disabled, all access will be allowed by the Enforce() function.
func (e *Enforcer) Enable(enable bool) {
	e.enabled = enable
}

// EnableLog changes whether to print Casbin log to the standard output.
func (e *Enforcer) EnableLog(enable bool) {
	util.EnableLog = enable
}

// Enforce decides whether a "subject" can access a "object" with the operation "action", input parameters are usually: (sub, obj, act).
func (e *Enforcer) Enforce(rvals ...interface{}) bool {
	if !e.enabled {
		return true
	}

	expString := e.model["m"]["m"].Value
	var expression *govaluate.EvaluableExpression

	functions := make(map[string]govaluate.ExpressionFunction)

	for key, function := range e.fm {
		functions[key] = function
	}

	_, ok := e.model["g"]
	if ok {
		for key, ast := range e.model["g"] {
			rm := ast.RM
			functions[key] = func(args ...interface{}) (interface{}, error) {
				if len(args) == 2 {
					name1 := args[0].(string)
					name2 := args[1].(string)

					return (bool)(rm.HasLink(name1, name2)), nil
				} else {
					name1 := args[0].(string)
					name2 := args[1].(string)
					domain := args[2].(string)

					return (bool)(rm.HasLink(name1, name2, domain)), nil
				}
			}
		}
	}
	expression, _ = govaluate.NewEvaluableExpressionWithFunctions(expString, functions)

	var policyResults []Effect
	if len(e.model["p"]["p"].Policy) != 0 {
		policyResults = make([]Effect, len(e.model["p"]["p"].Policy))

		for i, pvals := range e.model["p"]["p"].Policy {
			// util.LogPrint("Policy Rule: ", pvals)

			parameters := make(map[string]interface{}, 8)
			for j, token := range e.model["r"]["r"].Tokens {
				parameters[token] = rvals[j]
			}
			for j, token := range e.model["p"]["p"].Tokens {
				parameters[token] = pvals[j]
			}

			result, err := expression.Evaluate(parameters)
			// util.LogPrint("Result: ", result)

			if err != nil {
				policyResults[i] = EFFECT_INDETERMINATE
				panic(err)
			} else {
				if !result.(bool) {
					policyResults[i] = EFFECT_INDETERMINATE
				} else {
					if effect, ok := parameters["p_eft"]; ok {
						if effect == "allow" {
							policyResults[i] = EFFECT_ALLOW
						} else if effect == "deny" {
							policyResults[i] = EFFECT_DENY
						} else {
							policyResults[i] = EFFECT_INDETERMINATE
						}
					} else {
						policyResults[i] = EFFECT_ALLOW
					}

					if e.model["e"]["e"].Value == "priority(p_eft) || deny" {
						break
					}
				}
			}
		}
	} else {
		policyResults = make([]Effect, 1)

		parameters := make(map[string]interface{}, 8)
		for j, token := range e.model["r"]["r"].Tokens {
			parameters[token] = rvals[j]
		}
		for _, token := range e.model["p"]["p"].Tokens {
			parameters[token] = ""
		}

		result, err := expression.Evaluate(parameters)
		// util.LogPrint("Result: ", result)

		if err != nil {
			policyResults[0] = EFFECT_INDETERMINATE
			panic(err)
		} else {
			if result.(bool) {
				policyResults[0] = EFFECT_ALLOW
			} else {
				policyResults[0] = EFFECT_INDETERMINATE
			}
		}
	}

	// util.LogPrint("Rule Results: ", policyResults)

	result := false
	if e.model["e"]["e"].Value == "some(where (p_eft == allow))" {
		result = false
		for _, eft := range policyResults {
			if eft == EFFECT_ALLOW {
				result = true
				break
			}
		}
	} else if e.model["e"]["e"].Value == "!some(where (p_eft == deny))" {
		result = true
		for _, eft := range policyResults {
			if eft == EFFECT_DENY {
				result = false
				break
			}
		}
	} else if e.model["e"]["e"].Value == "some(where (p_eft == allow)) && !some(where (p_eft == deny))" {
		result = false
		for _, eft := range policyResults {
			if eft == EFFECT_ALLOW {
				result = true
			} else if eft == EFFECT_DENY {
				result = false
				break
			}
		}
	} else if e.model["e"]["e"].Value == "priority(p_eft) || deny" {
		result = false
		for _, eft := range policyResults {
			if eft != EFFECT_INDETERMINATE {
				if eft == EFFECT_ALLOW {
					result = true
				} else {
					result = false
				}
				break
			}
		}
	}

	reqStr := "Request: "
	for i, rval := range rvals {
		if i != len(rvals) - 1 {
			reqStr += fmt.Sprintf("%v, ", rval)
		} else {
			reqStr += fmt.Sprintf("%v", rval)
		}
	}
	reqStr += " ---> " + strconv.FormatBool(result)
	util.LogPrint(reqStr)

	return result
}
