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
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/procedures"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ProcedureSecurityContext determines whether the stored procedure is executed using the privileges of the definer or
// the invoker.
type ProcedureSecurityContext byte

const (
	// ProcedureSecurityContext_Definer uses the definer's security context.
	ProcedureSecurityContext_Definer ProcedureSecurityContext = iota
	// ProcedureSecurityContext_Invoker uses the invoker's security context.
	ProcedureSecurityContext_Invoker
)

// ProcedureParamDirection represents the use case of the stored procedure parameter.
type ProcedureParamDirection byte

const (
	// ProcedureParamDirection_In means the parameter passes its contained value to the stored procedure.
	ProcedureParamDirection_In ProcedureParamDirection = iota
	// ProcedureParamDirection_Inout means the parameter passes its contained value to the stored procedure, while also
	// modifying the given variable.
	ProcedureParamDirection_Inout
	// ProcedureParamDirection_Out means the parameter variable will be modified, but will not be read from within the
	// stored procedure.
	ProcedureParamDirection_Out
)

// ProcedureParam represents the parameter of a stored procedure.
type ProcedureParam struct {
	Type      sql.Type
	Name      string
	Direction ProcedureParamDirection
	Variadic  bool
}

// Characteristic represents a characteristic that is defined on either a stored procedure or stored function.
type Characteristic byte

const (
	Characteristic_LanguageSql Characteristic = iota
	Characteristic_Deterministic
	Characteristic_NotDeterministic
	Characteristic_ContainsSql
	Characteristic_NoSql
	Characteristic_ReadsSqlData
	Characteristic_ModifiesSqlData
)

// Procedure is a stored procedure that may be executed using the CALL statement.
type Procedure struct {
	CreatedAt    time.Time
	ModifiedAt   time.Time
	ExternalProc sql.Node

	ValidationError error

	Name                  string
	Definer               string
	Comment               string
	CreateProcedureString string

	Params          []ProcedureParam
	Characteristics []Characteristic
	Ops             []*procedures.InterpreterOperation
	SecurityContext ProcedureSecurityContext
}

var _ sql.Node = (*Procedure)(nil)
var _ sql.DebugStringer = (*Procedure)(nil)
var _ sql.CollationCoercible = (*Procedure)(nil)
var _ RepresentsBlock = (*Procedure)(nil)

// NewProcedure returns a *Procedure. All names contained within are lowercase, and all methods are case-insensitive.
func NewProcedure(
	name string,
	definer string,
	params []ProcedureParam,
	securityContext ProcedureSecurityContext,
	comment string,
	characteristics []Characteristic,
	createProcedureString string,
	createdAt time.Time,
	modifiedAt time.Time,
	ops []*procedures.InterpreterOperation,
) *Procedure {
	lowercasedParams := make([]ProcedureParam, len(params))
	for i, param := range params {
		lowercasedParams[i] = ProcedureParam{
			Direction: param.Direction,
			Name:      strings.ToLower(param.Name),
			Type:      param.Type,
			Variadic:  param.Variadic,
		}
	}
	return &Procedure{
		Name:                  strings.ToLower(name),
		Definer:               definer,
		Params:                lowercasedParams,
		SecurityContext:       securityContext,
		Comment:               comment,
		Characteristics:       characteristics,
		CreateProcedureString: createProcedureString,
		CreatedAt:             createdAt,
		ModifiedAt:            modifiedAt,

		Ops: ops,
	}
}

// Resolved implements the sql.Node interface.
func (p *Procedure) Resolved() bool {
	if p.ExternalProc != nil {
		return p.ExternalProc.Resolved()
	}
	return true
}

// IsReadOnly implements the sql.Node interface.
func (p *Procedure) IsReadOnly() bool {
	if p.ExternalProc != nil {
		return p.ExternalProc.IsReadOnly()
	}
	return false
}

// String implements the sql.Node interface.
func (p *Procedure) String() string {
	if p.ExternalProc != nil {
		return p.ExternalProc.String()
	}
	return ""
}

// DebugString implements the sql.DebugStringer interface.
func (p *Procedure) DebugString() string {
	return sql.DebugString(p.Ops)
}

// Schema implements the sql.Node interface.
func (p *Procedure) Schema() sql.Schema {
	if p.ExternalProc != nil {
		return p.ExternalProc.Schema()
	}
	return types.OkResultSchema
}

// Children implements the sql.Node interface.
func (p *Procedure) Children() []sql.Node {
	if p.ExternalProc != nil {
		return []sql.Node{p.ExternalProc}
	}
	return nil
}

// WithChildren implements the sql.Node interface.
func (p *Procedure) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) == 0 {
		return p, nil
	}
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}
	np := *p
	np.ExternalProc = children[0]
	return &np, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (p *Procedure) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, p.Ops)
}

// implementsRepresentsBlock implements the RepresentsBlock interface.
func (p *Procedure) implementsRepresentsBlock() {}

// ExtendVariadic returns a new procedure that has the variadic parameter extended to match the CALL's parameter count.
func (p *Procedure) ExtendVariadic(ctx *sql.Context, length int) *Procedure {
	if !p.HasVariadicParameter() {
		return p
	}
	np := *p
	body := p.ExternalProc.(*ExternalProcedure)
	newBody := *body
	np.ExternalProc = &newBody

	newParamDefinitions := make([]ProcedureParam, length)
	newParams := make([]*expression.ProcedureParam, length)
	if length < len(p.Params) {
		newParamDefinitions = p.Params[:len(p.Params)-1]
		newParams = body.Params[:len(body.Params)-1]
	} else {
		for i := range p.Params {
			newParamDefinitions[i] = p.Params[i]
			newParams[i] = body.Params[i]
		}
		if length >= len(p.Params) {
			variadicParam := p.Params[len(p.Params)-1]
			for i := len(p.Params); i < length; i++ {
				paramName := "A" + strconv.FormatInt(int64(i), 10)
				newParamDefinitions[i] = ProcedureParam{
					Direction: variadicParam.Direction,
					Name:      paramName,
					Type:      variadicParam.Type,
					Variadic:  variadicParam.Variadic,
				}
				newParams[i] = expression.NewProcedureParam(paramName, variadicParam.Type)
			}
		}
	}

	newBody.ParamDefinitions = newParamDefinitions
	newBody.Params = newParams
	np.Params = newParamDefinitions
	return &np
}

// HasVariadicParameter returns if the last parameter is variadic.
func (p *Procedure) HasVariadicParameter() bool {
	if len(p.Params) > 0 {
		return p.Params[len(p.Params)-1].Variadic
	}
	return false
}

// IsExternal returns whether the stored procedure is external.
func (p *Procedure) IsExternal() bool {
	if _, ok := p.ExternalProc.(*ExternalProcedure); ok {
		return true
	}
	return false
}

// String returns the original SQL representation.
func (pst ProcedureSecurityContext) String() string {
	switch pst {
	case ProcedureSecurityContext_Definer:
		return "SQL SECURITY DEFINER"
	case ProcedureSecurityContext_Invoker:
		return "SQL SECURITY INVOKER"
	default:
		panic(fmt.Errorf("invalid security context value `%d`", byte(pst)))
	}
}

// String returns the original SQL representation.
func (pp ProcedureParam) String() string {
	direction := ""
	switch pp.Direction {
	case ProcedureParamDirection_In:
		direction = "IN"
	case ProcedureParamDirection_Inout:
		direction = "INOUT"
	case ProcedureParamDirection_Out:
		direction = "OUT"
	}
	return fmt.Sprintf("%s %s %s", direction, pp.Name, pp.Type.String())
}

// String returns the original SQL representation.
func (c Characteristic) String() string {
	switch c {
	case Characteristic_LanguageSql:
		return "LANGUAGE SQL"
	case Characteristic_Deterministic:
		return "DETERMINISTIC"
	case Characteristic_NotDeterministic:
		return "NOT DETERMINISTIC"
	case Characteristic_ContainsSql:
		return "CONTAINS SQL"
	case Characteristic_NoSql:
		return "NO SQL"
	case Characteristic_ReadsSqlData:
		return "READS SQL DATA"
	case Characteristic_ModifiesSqlData:
		return "MODIFIES SQL DATA"
	default:
		panic(fmt.Errorf("invalid characteristic value `%d`", byte(c)))
	}
}
