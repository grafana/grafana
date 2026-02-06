package ast

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/tools"
)

type Builder struct {
	For Object

	// The builder itself
	// These fields are completely derived from the fields above and can be freely manipulated
	// by veneers.
	Package     string
	Name        string
	Properties  []StructField `json:",omitempty"`
	Constructor Constructor   `json:",omitempty"`
	Options     []Option
	VeneerTrail []string `json:",omitempty"`

	Factories []BuilderFactory `json:",omitempty"`
}

func (builder *Builder) OptionByName(name string) (Option, bool) {
	for _, opt := range builder.Options {
		if strings.EqualFold(opt.Name, name) {
			return opt, true
		}
	}

	return Option{}, false
}

func (builder *Builder) DeepCopy() Builder {
	clone := Builder{
		For:         builder.For,
		Package:     builder.Package,
		Name:        builder.Name,
		Properties:  make([]StructField, 0, len(builder.Properties)),
		Constructor: builder.Constructor.DeepCopy(),
		Options:     make([]Option, 0, len(builder.Options)),
		VeneerTrail: make([]string, 0, len(builder.VeneerTrail)),
	}

	clone.VeneerTrail = append(clone.VeneerTrail, builder.VeneerTrail...)

	for _, property := range builder.Properties {
		clone.Properties = append(clone.Properties, property.DeepCopy())
	}
	for _, opt := range builder.Options {
		clone.Options = append(clone.Options, opt.DeepCopy())
	}

	return clone
}

func (builder *Builder) AddToVeneerTrail(veneerName string) {
	builder.VeneerTrail = append(builder.VeneerTrail, veneerName)
}

func (builder *Builder) MakePath(builders Builders, pathAsString string) (Path, error) {
	if pathAsString == "" {
		return nil, fmt.Errorf("can not make path from empty input")
	}

	resolveRef := func(ref RefType) (Builder, error) {
		referredObjBuilder, found := builders.LocateByObject(ref.ReferredPkg, ref.ReferredType)
		if !found {
			return Builder{}, fmt.Errorf("could not make path '%s': reference '%s' could not be resolved", pathAsString, ref.String())
		}

		return referredObjBuilder, nil
	}

	currentType := builder.For.Type

	var path Path

	pathParts := strings.Split(pathAsString, ".")
	for _, part := range pathParts {
		if currentType.IsRef() {
			referredObjBuilder, err := resolveRef(currentType.AsRef())
			if err != nil {
				return nil, err
			}

			currentType = referredObjBuilder.For.Type
		}

		if !currentType.IsStruct() {
			return nil, fmt.Errorf("could not make path '%s': type at path '%s' is not a struct or a ref", pathAsString, path.String())
		}

		field, found := currentType.AsStruct().FieldByName(part)
		if !found {
			return nil, fmt.Errorf("could not make path '%s': field '%s' not found under path '%s'", pathAsString, part, path.String())
		}

		path = append(path, PathItem{
			Identifier: part,
			Type:       field.Type,
		})

		currentType = field.Type
	}

	return path, nil
}

type Constructor struct {
	Args        []Argument   `json:",omitempty"`
	Assignments []Assignment `json:",omitempty"`
}

func (constructor *Constructor) DeepCopy() Constructor {
	clone := Constructor{
		Args:        make([]Argument, 0, len(constructor.Args)),
		Assignments: make([]Assignment, 0, len(constructor.Assignments)),
	}

	for _, arg := range constructor.Args {
		clone.Args = append(clone.Args, arg.DeepCopy())
	}
	for _, assignment := range constructor.Assignments {
		clone.Assignments = append(clone.Assignments, assignment.DeepCopy())
	}

	return clone
}

type Builders []Builder

func (builders Builders) LocateByObject(pkg string, name string) (Builder, bool) {
	for _, builder := range builders {
		if builder.For.SelfRef.ReferredPkg == pkg && builder.For.SelfRef.ReferredType == name {
			return builder, true
		}
	}

	return Builder{}, false
}

func (builders Builders) LocateByName(pkg string, name string) (Builder, bool) {
	for _, builder := range builders {
		if builder.For.SelfRef.ReferredPkg == pkg && builder.Name == name {
			return builder, true
		}
	}

	return Builder{}, false
}

func (builders Builders) ByPackage(pkg string) Builders {
	return tools.Filter(builders, func(builder Builder) bool {
		return builder.Package == pkg
	})
}

func (builders Builders) LocateAllByObject(pkg string, name string) Builders {
	return tools.Filter(builders, func(builder Builder) bool {
		return builder.For.SelfRef.ReferredPkg == pkg && builder.For.SelfRef.ReferredType == name
	})
}

func (builders Builders) LocateAllByRef(ref RefType) Builders {
	return builders.LocateAllByObject(ref.ReferredPkg, ref.ReferredType)
}

func (builders Builders) HaveConstantConstructorAssignment() bool {
	for _, builder := range builders {
		constantAssignmentFound := false
		for _, assignment := range builder.Constructor.Assignments {
			if assignment.HasConstantValue() {
				constantAssignmentFound = true
				break
			}
		}

		if !constantAssignmentFound {
			return false
		}
	}

	return true
}

type Option struct {
	Name        string
	Comments    []string `json:",omitempty"`
	VeneerTrail []string `json:",omitempty"`
	Args        []Argument
	Assignments []Assignment
	Default     *OptionDefault `json:",omitempty"`
}

func (opt *Option) DeepCopy() Option {
	clone := Option{
		Name:        opt.Name,
		Comments:    make([]string, 0, len(opt.Comments)),
		VeneerTrail: make([]string, 0, len(opt.VeneerTrail)),
		Args:        make([]Argument, 0, len(opt.Args)),
		Assignments: make([]Assignment, 0, len(opt.Assignments)),
	}

	clone.Comments = append(clone.Comments, opt.Comments...)
	clone.VeneerTrail = append(clone.VeneerTrail, opt.VeneerTrail...)
	for _, arg := range opt.Args {
		clone.Args = append(clone.Args, arg.DeepCopy())
	}
	for _, assignment := range opt.Assignments {
		clone.Assignments = append(clone.Assignments, assignment.DeepCopy())
	}

	return clone
}

func (opt *Option) AddToVeneerTrail(veneerName string) {
	opt.VeneerTrail = append(opt.VeneerTrail, veneerName)
}

type OptionDefault struct {
	ArgsValues []any
}

type Argument struct {
	Name string
	Type Type
}

func (arg *Argument) DeepCopy() Argument {
	return Argument{
		Name: arg.Name,
		Type: arg.Type.DeepCopy(),
	}
}

type PathIndex struct {
	Argument *Argument
	Constant any // string or int
}

func (index PathIndex) DeepCopy() PathIndex {
	clone := PathIndex{
		Constant: index.Constant,
	}

	if index.Argument != nil {
		arg := index.Argument.DeepCopy()
		clone.Argument = &arg
	}

	return clone
}

type PathItem struct {
	Identifier string
	Index      *PathIndex
	Type       Type // any
	// useful mostly for composability purposes, when a field Type is "any"
	// and we're trying to "compose in" something of a known type.
	TypeHint *Type `json:",omitempty"`
	// Is this element of the path the root? (ie: a variable, not a member of a struct)
	Root bool
}

func (item PathItem) DeepCopy() PathItem {
	clone := PathItem{
		Identifier: item.Identifier,
		Type:       item.Type.DeepCopy(),
		Root:       item.Root,
	}

	if item.Index != nil {
		index := item.Index.DeepCopy()
		clone.Index = &index
	}

	if item.TypeHint != nil {
		hint := item.TypeHint.DeepCopy()
		clone.TypeHint = &hint
	}

	return clone
}

type Path []PathItem

func (path Path) DeepCopy() Path {
	clone := make([]PathItem, 0, len(path))

	for _, item := range path {
		clone = append(clone, item.DeepCopy())
	}

	return clone
}

func PathFromStructField(field StructField) Path {
	return Path{
		{
			Identifier: field.Name,
			Type:       field.Type,
		},
	}
}

func (path Path) Append(suffix Path) Path {
	var newPath Path
	newPath = append(newPath, path...)
	newPath = append(newPath, suffix...)

	return newPath
}

func (path Path) AppendStructField(field StructField) Path {
	return path.Append(PathFromStructField(field))
}

func (path Path) Last() PathItem {
	return path[len(path)-1]
}

func (path Path) RemoveLast() Path {
	return path[:len(path)-1]
}

func (path Path) String() string {
	return strings.Join(tools.Map(path, func(t PathItem) string {
		return t.Identifier
	}), ".")
}

type EnvelopeFieldValue struct {
	Path  Path            // where to assign within the struct/ref
	Value AssignmentValue // what to assign
}

func (value *EnvelopeFieldValue) DeepCopy() EnvelopeFieldValue {
	return EnvelopeFieldValue{
		Path:  value.Path.DeepCopy(),
		Value: value.Value.DeepCopy(),
	}
}

type AssignmentEnvelope struct {
	Type   Type // Should be a ref or a struct only
	Values []EnvelopeFieldValue
}

func (envelope *AssignmentEnvelope) DeepCopy() AssignmentEnvelope {
	clone := AssignmentEnvelope{
		Type:   envelope.Type.DeepCopy(),
		Values: make([]EnvelopeFieldValue, 0, len(envelope.Values)),
	}

	for _, value := range envelope.Values {
		clone.Values = append(clone.Values, value.DeepCopy())
	}

	return clone
}

type AssignmentValue struct {
	Argument *Argument           `json:",omitempty"`
	Constant any                 `json:",omitempty"`
	Envelope *AssignmentEnvelope `json:",omitempty"`
}

func (value *AssignmentValue) DeepCopy() AssignmentValue {
	clone := AssignmentValue{
		Constant: value.Constant,
	}

	if value.Argument != nil {
		arg := value.Argument.DeepCopy()
		clone.Argument = &arg
	}

	if value.Envelope != nil {
		envelope := value.Envelope.DeepCopy()
		clone.Envelope = &envelope
	}

	return clone
}

type AssignmentMethod string

const (
	DirectAssignment AssignmentMethod = "direct" // `foo = bar`
	AppendAssignment AssignmentMethod = "append" // `foo = append(foo, bar)`
	IndexAssignment  AssignmentMethod = "index"  // `foo[key] = bar`
)

type AssignmentNilCheck struct {
	Path Path

	EmptyValueType Type
}

func (check *AssignmentNilCheck) DeepCopy() AssignmentNilCheck {
	return AssignmentNilCheck{
		Path:           check.Path.DeepCopy(),
		EmptyValueType: check.EmptyValueType.DeepCopy(),
	}
}

type Assignment struct {
	// Where
	Path Path

	// What
	Value AssignmentValue

	// How
	Method AssignmentMethod

	Constraints []AssignmentConstraint `json:",omitempty"`

	NilChecks []AssignmentNilCheck `json:",omitempty"`
}

func (assignment *Assignment) HasConstantValue() bool {
	return assignment.Value.Constant != nil
}

func (assignment *Assignment) DeepCopy() Assignment {
	return Assignment{
		Path:   assignment.Path.DeepCopy(),
		Value:  assignment.Value.DeepCopy(),
		Method: assignment.Method,
		Constraints: tools.Map(assignment.Constraints, func(constraint AssignmentConstraint) AssignmentConstraint {
			return constraint.DeepCopy()
		}),
		NilChecks: tools.Map(assignment.NilChecks, func(check AssignmentNilCheck) AssignmentNilCheck {
			return check.DeepCopy()
		}),
	}
}

type AssignmentConstraint struct {
	Argument  Argument
	Op        Op
	Parameter any
}

func (constraint AssignmentConstraint) DeepCopy() AssignmentConstraint {
	return AssignmentConstraint{
		Argument:  constraint.Argument.DeepCopy(),
		Op:        constraint.Op,
		Parameter: constraint.Parameter,
	}
}

type AssignmentOpt func(assignment *Assignment)

func WithTypeConstraints(constraints []TypeConstraint) AssignmentOpt {
	return func(assignment *Assignment) {
		assignment.Constraints = tools.Map(constraints, func(constraint TypeConstraint) AssignmentConstraint {
			return AssignmentConstraint{
				Argument:  *assignment.Value.Argument,
				Op:        constraint.Op,
				Parameter: constraint.Args[0],
			}
		})
	}
}

func Method(method AssignmentMethod) AssignmentOpt {
	return func(assignment *Assignment) {
		assignment.Method = method
	}
}

func ConstantAssignment(path Path, value any, opts ...AssignmentOpt) Assignment {
	assignment := Assignment{
		Path: path,
		Value: AssignmentValue{
			Constant: value,
		},
		Method: DirectAssignment,
	}

	for _, opt := range opts {
		opt(&assignment)
	}

	return assignment
}

func ArgumentAssignment(path Path, argument Argument, opts ...AssignmentOpt) Assignment {
	assignment := Assignment{
		Path: path,
		Value: AssignmentValue{
			Argument: &argument,
		},
		Method: DirectAssignment,
	}

	for _, opt := range opts {
		opt(&assignment)
	}

	return assignment
}

func FieldAssignment(field StructField, opts ...AssignmentOpt) Assignment {
	var constraints []TypeConstraint
	if field.Type.IsScalar() {
		constraints = field.Type.AsScalar().Constraints
	}

	argument := Argument{Name: field.Name, Type: field.Type}
	allOpts := []AssignmentOpt{WithTypeConstraints(constraints)}
	allOpts = append(allOpts, opts...)

	return ArgumentAssignment(PathFromStructField(field), argument, allOpts...)
}

type BuilderGenerator struct {
}

func (generator *BuilderGenerator) FromAST(schemas Schemas) []Builder {
	builders := make([]Builder, 0, len(schemas))

	for _, schema := range schemas {
		schema.Objects.Iterate(func(_ string, object Object) {
			resolvedType := schemas.ResolveToType(object.Type)
			if !resolvedType.IsAnyOf(KindStruct, KindRef) {
				return
			}

			builders = append(builders, generator.structObjectToBuilder(schemas, schema, object))
		})
	}

	return builders
}

func (generator *BuilderGenerator) structObjectToBuilder(schemas Schemas, schema *Schema, object Object) Builder {
	builder := Builder{
		Package: schema.Package,
		For:     object,
		Name:    object.Name,
	}

	structType := schemas.ResolveToType(object.Type).AsStruct()
	for _, field := range structType.Fields {
		if field.Type.IsScalar() && field.Type.AsScalar().IsConcrete() {
			constantAssignment := ConstantAssignment(PathFromStructField(field), field.Type.AsScalar().Value)

			builder.Constructor.Assignments = append(builder.Constructor.Assignments, constantAssignment)
			continue
		}
		if field.Required && !field.Type.Nullable && generator.fieldIsRefToConcrete(schemas, field) {
			resolvedType := schemas.ResolveToType(field.Type)

			constantAssignment := ConstantAssignment(PathFromStructField(field), resolvedType.AsScalar().Value)
			builder.Constructor.Assignments = append(builder.Constructor.Assignments, constantAssignment)

			continue
		}
		if field.Required && !field.Type.Nullable && field.Type.IsConstantRef() {
			continue
		}

		builder.Options = append(builder.Options, generator.structFieldToOption(field))
	}

	return builder
}

func (generator *BuilderGenerator) fieldIsRefToConcrete(schemas Schemas, field StructField) bool {
	if !field.Type.IsRef() {
		return false
	}

	return schemas.ResolveToType(field.Type).IsConcreteScalar()
}

func (generator *BuilderGenerator) structFieldToOption(field StructField) Option {
	opt := Option{
		Name:     field.Name,
		Comments: field.Comments,
		Args: []Argument{
			{Name: field.Name, Type: field.Type},
		},
		Assignments: []Assignment{
			FieldAssignment(field),
		},
	}

	if field.Type.Default != nil {
		opt.Default = &OptionDefault{
			ArgsValues: []any{field.Type.Default},
		}
	}

	return opt
}
