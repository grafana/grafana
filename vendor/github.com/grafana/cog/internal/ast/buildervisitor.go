package ast

import (
	"fmt"

	"github.com/grafana/cog/internal/tools"
)

type VisitBuilderFunc func(visitor *BuilderVisitor, schemas Schemas, builder Builder) (Builder, error)
type VisitPropertyFunc func(visitor *BuilderVisitor, schemas Schemas, builder Builder, property StructField) (StructField, error)
type VisitConstructorFunc func(visitor *BuilderVisitor, schemas Schemas, builder Builder, constructor Constructor) (Constructor, error)
type VisitOptionFunc func(visitor *BuilderVisitor, schemas Schemas, builder Builder, option Option) (Option, error)
type VisitArgumentFunc func(visitor *BuilderVisitor, schemas Schemas, builder Builder, argument Argument) (Argument, error)
type VisitAssignmentFunc func(visitor *BuilderVisitor, schemas Schemas, builder Builder, assignment Assignment) (Assignment, error)

type BuilderVisitor struct {
	OnBuilder     VisitBuilderFunc
	OnProperty    VisitPropertyFunc
	OnConstructor VisitConstructorFunc
	OnOption      VisitOptionFunc
	OnArgument    VisitArgumentFunc
	OnAssignment  VisitAssignmentFunc
}

func (visitor *BuilderVisitor) Visit(schemas Schemas, builders Builders) (Builders, error) {
	var err error

	for i, builder := range builders {
		builders[i], err = visitor.VisitBuilder(schemas, builder)
		if err != nil {
			return nil, fmt.Errorf("[%s.%s] %w", builder.Package, builder.Name, err)
		}
	}

	return builders, nil
}

func (visitor *BuilderVisitor) VisitBuilder(schemas Schemas, builder Builder) (Builder, error) {
	if visitor.OnBuilder != nil {
		return visitor.OnBuilder(visitor, schemas, builder)
	}

	return visitor.TraverseBuilder(schemas, builder)
}

func (visitor *BuilderVisitor) TraverseBuilder(schemas Schemas, builder Builder) (Builder, error) {
	var prop StructField
	var opt Option
	var err error

	builder.Constructor, err = visitor.VisitConstructor(schemas, builder, builder.Constructor)
	if err != nil {
		return builder, err
	}

	builder.Properties = tools.Map(builder.Properties, func(property StructField) StructField {
		if err != nil {
			return property
		}

		prop, err = visitor.VisitProperty(schemas, builder, property)
		return prop
	})
	if err != nil {
		return builder, err
	}

	builder.Options = tools.Map(builder.Options, func(option Option) Option {
		if err != nil {
			return option
		}

		opt, err = visitor.VisitOption(schemas, builder, option)
		return opt
	})

	return builder, err
}

func (visitor *BuilderVisitor) VisitProperty(schemas Schemas, builder Builder, property StructField) (StructField, error) {
	if visitor.OnProperty != nil {
		return visitor.OnProperty(visitor, schemas, builder, property)
	}

	return property, nil
}

func (visitor *BuilderVisitor) VisitConstructor(schemas Schemas, builder Builder, constructor Constructor) (Constructor, error) {
	if visitor.OnConstructor != nil {
		return visitor.OnConstructor(visitor, schemas, builder, constructor)
	}

	return visitor.TraverseConstructor(schemas, builder, constructor)
}

func (visitor *BuilderVisitor) TraverseConstructor(schemas Schemas, builder Builder, constructor Constructor) (Constructor, error) {
	var arg Argument
	var assign Assignment
	var err error

	constructor.Args = tools.Map(constructor.Args, func(argument Argument) Argument {
		if err != nil {
			return argument
		}

		arg, err = visitor.VisitArgument(schemas, builder, argument)
		return arg
	})
	if err != nil {
		return constructor, err
	}
	constructor.Assignments = tools.Map(constructor.Assignments, func(assignment Assignment) Assignment {
		assign, err = visitor.VisitAssignment(schemas, builder, assignment)
		return assign
	})

	return constructor, err
}

func (visitor *BuilderVisitor) VisitArgument(schemas Schemas, builder Builder, argument Argument) (Argument, error) {
	if visitor.OnArgument != nil {
		return visitor.OnArgument(visitor, schemas, builder, argument)
	}

	return argument, nil
}

func (visitor *BuilderVisitor) VisitAssignment(schemas Schemas, builder Builder, assignment Assignment) (Assignment, error) {
	if visitor.OnAssignment != nil {
		return visitor.OnAssignment(visitor, schemas, builder, assignment)
	}

	var arg Argument
	var err error
	assignment.Constraints = tools.Map(assignment.Constraints, func(constraint AssignmentConstraint) AssignmentConstraint {
		if err != nil {
			return constraint
		}
		arg, err = visitor.VisitArgument(schemas, builder, constraint.Argument)
		constraint.Argument = arg
		return constraint
	})

	return assignment, err
}

func (visitor *BuilderVisitor) VisitOption(schemas Schemas, builder Builder, option Option) (Option, error) {
	if visitor.OnOption != nil {
		return visitor.OnOption(visitor, schemas, builder, option)
	}

	return visitor.TraverseOption(schemas, builder, option)
}

func (visitor *BuilderVisitor) TraverseOption(schemas Schemas, builder Builder, option Option) (Option, error) {
	var argument Argument
	var assign Assignment
	var err error

	option.Args = tools.Map(option.Args, func(arg Argument) Argument {
		if err != nil {
			return arg
		}

		argument, err = visitor.VisitArgument(schemas, builder, arg)
		return argument
	})
	if err != nil {
		return option, err
	}

	option.Assignments = tools.Map(option.Assignments, func(assignment Assignment) Assignment {
		if err != nil {
			return assignment
		}

		assign, err = visitor.VisitAssignment(schemas, builder, assignment)
		return assign
	})

	return option, err
}
