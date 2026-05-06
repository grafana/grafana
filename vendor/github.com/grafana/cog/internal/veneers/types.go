package veneers

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

type Option struct {
	Name        string         `yaml:"name"`
	Comments    []string       `yaml:"comments"`
	Arguments   []ast.Argument `yaml:"arguments"`
	Assignments []Assignment   `yaml:"assignments"`
}

func (opt Option) AsIR(schemas ast.Schemas, builders ast.Builders, root ast.Builder) (ast.Option, error) {
	assignments := make([]ast.Assignment, 0, len(opt.Assignments))
	for _, assignment := range opt.Assignments {
		irAssignment, err := assignment.AsIR(schemas, builders, root)
		if err != nil {
			return ast.Option{}, err
		}

		assignments = append(assignments, irAssignment)
	}

	return ast.Option{
		Name:        opt.Name,
		Comments:    opt.Comments,
		Args:        opt.Arguments,
		Assignments: assignments,
	}, nil
}

type Assignment struct {
	Path   string               `yaml:"path"`
	Method ast.AssignmentMethod `yaml:"method"`
	Value  AssignmentValue      `yaml:"value"`
}

func (assignment Assignment) AsIR(schemas ast.Schemas, builders ast.Builders, root ast.Builder) (ast.Assignment, error) {
	path, err := root.MakePath(builders, assignment.Path)
	if err != nil {
		return ast.Assignment{}, err
	}

	value, err := assignment.Value.AsIR(schemas, path)
	if err != nil {
		return ast.Assignment{}, err
	}

	return ast.Assignment{
		Path:   path,
		Value:  value,
		Method: assignment.Method,
	}, nil
}

type AssignmentValue struct {
	Argument *ast.Argument       `json:",omitempty"`
	Constant any                 `json:",omitempty"`
	Envelope *AssignmentEnvelope `json:",omitempty"`
}

func (value AssignmentValue) AsIR(schemas ast.Schemas, assignmentPath ast.Path) (ast.AssignmentValue, error) {
	if value.Argument != nil {
		return ast.AssignmentValue{Argument: value.Argument}, nil
	}
	if value.Constant != nil {
		return ast.AssignmentValue{Constant: value.Constant}, nil
	}
	if value.Envelope != nil {
		envelopeType := assignmentPath.Last().Type
		if envelopeType.IsArray() {
			envelopeType = envelopeType.Array.ValueType
		}
		if envelopeType.IsMap() {
			envelopeType = envelopeType.Map.ValueType
		}

		envelope, err := value.Envelope.AsIR(schemas, envelopeType)
		if err != nil {
			return ast.AssignmentValue{}, err
		}

		return ast.AssignmentValue{Envelope: &envelope}, nil
	}

	return ast.AssignmentValue{}, fmt.Errorf("empty assignment value")
}

type AssignmentEnvelope struct {
	Values []EnvelopeFieldValue
}

func (envelope AssignmentEnvelope) AsIR(schemas ast.Schemas, envelopeType ast.Type) (ast.AssignmentEnvelope, error) {
	var err error
	values := make([]ast.EnvelopeFieldValue, len(envelope.Values))
	for i, val := range envelope.Values {
		values[i], err = val.AsIR(schemas, envelopeType)
		if err != nil {
			return ast.AssignmentEnvelope{}, err
		}
	}

	return ast.AssignmentEnvelope{
		Type:   envelopeType,
		Values: values,
	}, nil
}

type EnvelopeFieldValue struct {
	Field string          // where to assign within the struct/ref
	Value AssignmentValue // what to assign
}

func (envelopeField EnvelopeFieldValue) AsIR(schemas ast.Schemas, envelopeType ast.Type) (ast.EnvelopeFieldValue, error) {
	resolvedEnvelope := schemas.ResolveToType(envelopeType)
	field, found := resolvedEnvelope.Struct.FieldByName(envelopeField.Field)
	if !found {
		return ast.EnvelopeFieldValue{}, fmt.Errorf("envelope field %s not found", envelopeField.Field)
	}

	path := ast.PathFromStructField(field)

	value, err := envelopeField.Value.AsIR(schemas, path)
	if err != nil {
		return ast.EnvelopeFieldValue{}, err
	}

	return ast.EnvelopeFieldValue{
		Path:  path,
		Value: value,
	}, nil
}
