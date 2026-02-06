// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build go1.18

package compute

import (
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
)

var (
	andDoc = FunctionDoc{
		Summary:     "Logical 'and' boolean values",
		Description: "When a null is encountered in either input, a null is output.\nFor a different null behavior, see function 'and_kleene'",
		ArgNames:    []string{"x", "y"},
	}
	andNotDoc = FunctionDoc{
		Summary:     "Logical 'and not' boolean values",
		Description: "When a null is encountered in either input, a null is output.\nFor a different null behavior, see function 'and_not_kleene'",
		ArgNames:    []string{"x", "y"},
	}
	orDoc = FunctionDoc{
		Summary:     "Logical 'or' boolean values",
		Description: "When a null is encountered in either input, a null is output.\nFor a different null behavior, see function 'or_kleene'",
		ArgNames:    []string{"x", "y"},
	}
	xorDoc = FunctionDoc{
		Summary:     "Logical 'xor' boolean values",
		Description: "When a null is encountered in either input, a null is output.",
		ArgNames:    []string{"x", "y"},
	}
	andKleeneDoc = FunctionDoc{
		Summary: "Logical 'and' boolean values (Kleene logic)",
		Description: `This function behaves as follows with nulls:
		
		- true and null = null
		- null and true = null
		- false and null = false
		- null and false = false
		- null and null = null
		
		In other words, in this context, a null value really means "unknown"
		and an unknown value "and" false is always false.
		For a different null behavior, see function "and".`,
		ArgNames: []string{"x", "y"},
	}
	andNotKleeneDoc = FunctionDoc{
		Summary: "Logical 'and_not' boolean values (Kleene logic)",
		Description: `This function behaves as follows with nulls:
		
		- true and not null = null
		- null and not false = null
		- false and not null = false
		- null and not true = false
		- null and not null = null
		
		In other words, in this context, a null value really means "unknown"
		and an unknown value "and not" true is always false, as is false
		"and not" an unknown value.
		For a different null behavior, see function "and_not".`,
		ArgNames: []string{"x", "y"},
	}
	orKleeneDoc = FunctionDoc{
		Summary: "Logical 'or' boolean values (Kleene logic)",
		Description: `This function behaves as follows with nulls:
		
		- true or null = true
		- null or true = true
		- false or null = null
		- null or false = null
		- null or null = null
		
		In other words, in this context, a null value really means "unknown"
		and an unknown value "or" true is always true.
		For a different null behavior, see function "and".`,
		ArgNames: []string{"x", "y"},
	}
	notDoc = FunctionDoc{
		Summary:     "Logical 'not' boolean values",
		Description: "Negates the input boolean value",
		ArgNames:    []string{"x"},
	}
)

func makeFunction(reg FunctionRegistry, name string, arity int, ex exec.ArrayKernelExec, doc FunctionDoc, nulls exec.NullHandling) {
	fn := NewScalarFunction(name, Arity{NArgs: arity}, doc)

	inTypes := make([]exec.InputType, arity)
	for i := range inTypes {
		inTypes[i] = exec.NewExactInput(arrow.FixedWidthTypes.Boolean)
	}

	k := exec.NewScalarKernel(inTypes, exec.NewOutputType(arrow.FixedWidthTypes.Boolean), ex, nil)
	k.NullHandling = nulls

	if err := fn.AddKernel(k); err != nil {
		panic(err)
	}

	if !reg.AddFunction(fn, false) {
		panic(fmt.Errorf("function '%s' already exists", name))
	}
}

func RegisterScalarBoolean(reg FunctionRegistry) {
	makeFunction(reg, "and", 2, kernels.SimpleBinary[kernels.AndOpKernel],
		andDoc, exec.NullIntersection)
	makeFunction(reg, "and_not", 2, kernels.SimpleBinary[kernels.AndNotOpKernel],
		andNotDoc, exec.NullIntersection)
	makeFunction(reg, "or", 2, kernels.SimpleBinary[kernels.OrOpKernel],
		orDoc, exec.NullIntersection)
	makeFunction(reg, "xor", 2, kernels.SimpleBinary[kernels.XorOpKernel],
		xorDoc, exec.NullIntersection)
	makeFunction(reg, "and_kleene", 2, kernels.SimpleBinary[kernels.KleeneAndOpKernel],
		andKleeneDoc, exec.NullComputedPrealloc)
	makeFunction(reg, "and_not_kleene", 2, kernels.SimpleBinary[kernels.KleeneAndNotOpKernel],
		andNotKleeneDoc, exec.NullComputedPrealloc)
	makeFunction(reg, "or_kleene", 2, kernels.SimpleBinary[kernels.KleeneOrOpKernel],
		orKleeneDoc, exec.NullComputedPrealloc)
	makeFunction(reg, "not", 1, kernels.NotExecKernel, notDoc,
		exec.NullComputedNoPrealloc)
}
