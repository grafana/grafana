// Copyright 2020-2021 Dolthub, Inc.
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

package spatial

import (
	"fmt"
	"strings"

	errors "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// STX is a function that returns the x value from a given point.
type STX struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*STX)(nil)
var _ sql.CollationCoercible = (*STX)(nil)

var ErrInvalidType = errors.NewKind("%s received non-point type")

// NewSTX creates a new STX expression.
func NewSTX(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 && len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_X", "1 or 2", len(args))
	}
	return &STX{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (s *STX) FunctionName() string {
	return "st_x"
}

// Description implements sql.FunctionExpression
func (s *STX) Description() string {
	return "returns the x value of given point. If given a second argument, returns a new point with second argument as x value."
}

// Type implements the sql.Expression interface.
func (s *STX) Type() sql.Type {
	if len(s.ChildExpressions) == 1 {
		return types.Float64
	} else {
		return types.PointType{}
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*STX) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (s *STX) String() string {
	var args = make([]string, len(s.ChildExpressions))
	for i, arg := range s.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("ST_X(%s)", strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (s *STX) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewSTX(children...)
}

// Eval implements the sql.Expression interface.
func (s *STX) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate point
	p, err := s.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if geometry is null
	if p == nil {
		return nil, nil
	}

	// Check that it is a point
	_p, ok := p.(types.Point)
	if !ok {
		return nil, ErrInvalidType.New(s.FunctionName())
	}

	// If just one argument, return X
	if len(s.ChildExpressions) == 1 {
		return _p.X, nil
	}

	// Evaluate second argument
	x, err := s.ChildExpressions[1].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if second argument is null
	if x == nil {
		return nil, nil
	}

	// Convert to float64
	_x, _, err := types.Float64.Convert(ctx, x)
	if err != nil {
		return nil, err
	}

	// Create point with new X and old Y
	return types.Point{SRID: _p.SRID, X: _x.(float64), Y: _p.Y}, nil
}

// STY is a function that returns the y value from a given point.
type STY struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*STY)(nil)
var _ sql.CollationCoercible = (*STY)(nil)

// NewSTY creates a new STY expression.
func NewSTY(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 && len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_Y", "1 or 2", len(args))
	}
	return &STY{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (s *STY) FunctionName() string {
	return "st_y"
}

// Description implements sql.FunctionExpression
func (s *STY) Description() string {
	return "returns the y value of given point. If given a second argument, returns a new point with second argument as y value."
}

// Type implements the sql.Expression interface.
func (s *STY) Type() sql.Type {
	if len(s.ChildExpressions) == 1 {
		return types.Float64
	} else {
		return types.PointType{}
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*STY) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (s *STY) String() string {
	var args = make([]string, len(s.ChildExpressions))
	for i, arg := range s.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("ST_Y(%s)", strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (s *STY) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewSTY(children...)
}

// Eval implements the sql.Expression interface.
func (s *STY) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate point
	p, err := s.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if geometry is null
	if p == nil {
		return nil, nil
	}

	// Check that it is a point
	_p, ok := p.(types.Point)
	if !ok {
		return nil, ErrInvalidType.New(s.FunctionName())
	}

	// If just one argument, return Y
	if len(s.ChildExpressions) == 1 {
		return _p.Y, nil
	}

	// Evaluate second argument
	y, err := s.ChildExpressions[1].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if second argument is null
	if y == nil {
		return nil, nil
	}

	// Convert to float64
	_y, _, err := types.Float64.Convert(ctx, y)
	if err != nil {
		return nil, err
	}

	// Create point with old X and new Ys
	return types.Point{SRID: _p.SRID, X: _p.X, Y: _y.(float64)}, nil
}

// Longitude is a function that returns the x value from a given point.
type Longitude struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*Longitude)(nil)
var _ sql.CollationCoercible = (*Longitude)(nil)

var ErrNonGeographic = errors.NewKind("function %s is only defined for geographic spatial reference systems, but one of its argument is in SRID %v, which is not geographic")
var ErrLatitudeOutOfRange = errors.NewKind("latitude %v is out of range in function %s. it must be within [-90.0, 90.0]")
var ErrLongitudeOutOfRange = errors.NewKind("longitude %v is out of range in function %s. it must be within [-180.0, 180.0]")

// NewLongitude creates a new ST_LONGITUDE expression.
func NewLongitude(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 && len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_LONGITUDE", "1 or 2", len(args))
	}
	return &Longitude{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *Longitude) FunctionName() string {
	return "st_longitude"
}

// Description implements sql.FunctionExpression
func (l *Longitude) Description() string {
	return "returns the longitude value of given point. If given a second argument, returns a new point with second argument as longitude value."
}

// Type implements the sql.Expression interface.
func (l *Longitude) Type() sql.Type {
	if len(l.ChildExpressions) == 1 {
		return types.Float64
	} else {
		return types.PointType{}
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Longitude) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (l *Longitude) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("ST_LONGITUDE(%s)", strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *Longitude) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewLongitude(children...)
}

// Eval implements the sql.Expression interface.
func (l *Longitude) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate point
	p, err := l.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if geometry is null
	if p == nil {
		return nil, nil
	}

	// Check that it is a point
	_p, ok := p.(types.Point)
	if !ok {
		return nil, ErrInvalidType.New(l.FunctionName())
	}

	// Point needs to have SRID 4326
	if _p.SRID != types.GeoSpatialSRID {
		return nil, ErrNonGeographic.New(l.FunctionName(), _p.SRID)
	}

	// If just one argument, return X
	if len(l.ChildExpressions) == 1 {
		return _p.X, nil
	}

	// Evaluate second argument
	x, err := l.ChildExpressions[1].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if second argument is null
	if x == nil {
		return nil, nil
	}

	// Convert to float64
	x, _, err = types.Float64.Convert(ctx, x)
	if err != nil {
		return nil, err
	}

	// Check that value is within longitude range [-180, 180]
	_x := x.(float64)
	if _x < -180.0 || _x > 180.0 {
		return nil, ErrLongitudeOutOfRange.New(_x, l.FunctionName())
	}

	// Create point with new X and old Y
	return types.Point{SRID: _p.SRID, X: _x, Y: _p.Y}, nil
}

// Latitude is a function that returns the x value from a given point.
type Latitude struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*Latitude)(nil)
var _ sql.CollationCoercible = (*Latitude)(nil)

// NewLatitude creates a new ST_LATITUDE expression.
func NewLatitude(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 && len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_LATITUDE", "1 or 2", len(args))
	}
	return &Latitude{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *Latitude) FunctionName() string {
	return "st_latitude"
}

// Description implements sql.FunctionExpression
func (l *Latitude) Description() string {
	return "returns the latitude value of given point. If given a second argument, returns a new point with second argument as latitude value."
}

// Type implements the sql.Expression interface.
func (l *Latitude) Type() sql.Type {
	if len(l.ChildExpressions) == 1 {
		return types.Float64
	} else {
		return types.PointType{}
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Latitude) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (l *Latitude) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("ST_LATITUDE(%s)", strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *Latitude) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewLatitude(children...)
}

// Eval implements the sql.Expression interface.
func (l *Latitude) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate point
	p, err := l.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if geometry is null
	if p == nil {
		return nil, nil
	}

	// Check that it is a point
	_p, ok := p.(types.Point)
	if !ok {
		return nil, ErrInvalidType.New(l.FunctionName())
	}

	// Point needs to have SRID 4326
	// TODO: might need to be == Cartesian instead for other SRIDs
	if _p.SRID != types.GeoSpatialSRID {
		return nil, ErrNonGeographic.New(l.FunctionName(), _p.SRID)
	}

	// If just one argument, return Y
	if len(l.ChildExpressions) == 1 {
		return _p.Y, nil
	}

	// Evaluate second argument
	y, err := l.ChildExpressions[1].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if second argument is null
	if y == nil {
		return nil, nil
	}

	// Convert to float64
	y, _, err = types.Float64.Convert(ctx, y)
	if err != nil {
		return nil, err
	}

	// Check that value is within latitude range [-90, 90]
	_y := y.(float64)
	if _y < -90.0 || _y > 90.0 {
		return nil, ErrLongitudeOutOfRange.New(_y, l.FunctionName())
	}

	// Create point with old X and new Y
	return types.Point{SRID: _p.SRID, X: _p.X, Y: _y}, nil
}
