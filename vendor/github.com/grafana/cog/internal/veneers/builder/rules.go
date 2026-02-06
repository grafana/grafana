package builder

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
	"github.com/grafana/cog/internal/veneers"
)

type RewriteRule func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error)

func mapToSelected(selector Selector, mapFunc func(builders ast.Builders, builder ast.Builder) (ast.Builder, error)) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, b := range builders {
			if !selector(schemas, b) {
				continue
			}

			newBuilder, err := mapFunc(builders, b)
			if err != nil {
				return nil, err
			}

			builders[i] = newBuilder
		}

		return builders, nil
	}
}

func mergeBuilderInto(fromBuilder ast.Builder, intoBuilder ast.Builder, underPath ast.Path, excludeOptions []string, renameOptions map[string]string) (ast.Builder, error) {
	newBuilder := intoBuilder
	if renameOptions == nil {
		renameOptions = map[string]string{}
	}

	// copy factories
	for _, factory := range fromBuilder.Factories {
		newBuilder.Factories = append(newBuilder.Factories, factory.DeepCopy())
	}

	// keep constant assignments
	for _, assignment := range fromBuilder.Constructor.Assignments {
		if assignment.Value.Constant == nil {
			continue
		}

		newAssignment := assignment
		newAssignment.Path = underPath.Append(assignment.Path)
		newBuilder.Constructor.Assignments = append(newBuilder.Constructor.Assignments, newAssignment)
	}

	// copy options
	for _, opt := range fromBuilder.Options {
		if tools.ItemInList(opt.Name, excludeOptions) {
			continue
		}

		newOpt := opt
		newOpt.Assignments = nil

		if as, found := renameOptions[newOpt.Name]; found {
			newOpt.Name = as
		}

		for _, assignment := range opt.Assignments {
			newAssignment := assignment
			newAssignment.Path = underPath.Append(assignment.Path)

			newOpt.Assignments = append(newOpt.Assignments, newAssignment)
		}

		newBuilder.Options = append(newBuilder.Options, newOpt)
	}

	return newBuilder, nil
}

func Omit(selector Selector) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		filteredBuilders := make([]ast.Builder, 0, len(builders))

		for _, builder := range builders {
			if selector(schemas, builder) {
				continue
			}

			filteredBuilders = append(filteredBuilders, builder)
		}

		return filteredBuilders, nil
	}
}

func MergeInto(selector Selector, sourceBuilderName string, underPath string, excludeOptions []string, renameOptions map[string]string) RewriteRule {
	return mapToSelected(selector, func(builders ast.Builders, destinationBuilder ast.Builder) (ast.Builder, error) {
		sourceBuilder, found := builders.LocateByName(destinationBuilder.For.SelfRef.ReferredPkg, sourceBuilderName)
		if !found {
			// We couldn't find the source builder: let's return the selected builder untouched.
			return destinationBuilder, nil
		}

		newRoot, err := destinationBuilder.MakePath(builders, underPath)
		if err != nil {
			return destinationBuilder, fmt.Errorf("could not apply MergeInto builder veneer: %w", err)
		}

		newBuilder, err := mergeBuilderInto(sourceBuilder, destinationBuilder, newRoot, excludeOptions, renameOptions)
		if err != nil {
			return ast.Builder{}, fmt.Errorf("could not apply MergeInto builder veneer: %w", err)
		}

		newBuilder.AddToVeneerTrail(fmt.Sprintf("MergeInto[source=%s]", sourceBuilder.Name))

		return newBuilder, nil
	})
}

func composeBuilderForType(schemas ast.Schemas, builders ast.Builders, config CompositionConfig, typeDiscriminator string, sourceBuilder ast.Builder, composableBuilders ast.Builders) (ast.Builders, error) {
	newBuilder := ast.Builder{
		Package:     composableBuilders[0].Package,
		For:         sourceBuilder.For,
		Name:        sourceBuilder.For.Name,
		Constructor: sourceBuilder.Constructor,
		Properties:  sourceBuilder.Properties,
	}
	if config.ComposedBuilderName != "" {
		newBuilder.Name = config.ComposedBuilderName
	}

	typeField, ok := sourceBuilder.For.Type.AsStruct().FieldByName(config.PluginDiscriminatorField)
	if !ok {
		return nil, fmt.Errorf("could not find plugin discriminator field '%s' in builder", config.PluginDiscriminatorField)
	}

	typeAssignment := ast.ConstantAssignment(ast.PathFromStructField(typeField), typeDiscriminator)
	newBuilder.Constructor.Assignments = append(newBuilder.Constructor.Assignments, typeAssignment)

	// re-add options coming from the source builder
	for _, panelOpt := range sourceBuilder.Options {
		// this value is now a constant
		if panelOpt.Name == config.PluginDiscriminatorField {
			continue
		}

		// Is the option explicitly excluded?
		if tools.StringInListEqualFold(panelOpt.Name, config.ExcludeOptions) {
			continue
		}

		newBuilder.Options = append(newBuilder.Options, panelOpt)
	}

	composedBuilders := make([]ast.Builder, 0, len(composableBuilders))
	for _, composableBuilder := range composableBuilders {
		underPath, exists := config.CompositionMap[composableBuilder.For.Name]
		if !exists {
			// schemas might define more types than just those present in the
			// composition map. We need to leave these objects untouched and
			// compose only the builders that we know of.
			composedBuilders = append(composedBuilders, composableBuilder)
			continue
		}

		newRoot, err := newBuilder.MakePath(builders, underPath)
		if err != nil {
			return nil, err
		}

		refType := composableBuilder.For.SelfRef.AsType()
		newRoot[len(newRoot)-1].TypeHint = &refType

		newBuilder, err = mergeBuilderInto(composableBuilder, newBuilder, newRoot, nil, config.RenameOptions)
		if err != nil {
			return nil, err
		}

		// we do this to ensure that the same builder can be composed more than once
		// ie: dashboard and dashboardv2 packages
		if config.PreserveOriginalBuilders {
			composedBuilders = append(composedBuilders, composableBuilder)
		}
	}

	if config.CompositionMap["__schema_entrypoint"] != "" {
		schema, _ := schemas.Locate(composableBuilders[0].Package)
		if schema.EntryPoint == "" {
			return nil, fmt.Errorf("schema '%s' does not have an entrypoint", schema.Package)
		}

		newRoot, err := newBuilder.MakePath(builders, config.CompositionMap["__schema_entrypoint"])
		if err != nil {
			return nil, err
		}

		resolvedEntrypointType := schemas.ResolveToType(schema.EntryPointType)

		switch {
		case resolvedEntrypointType.IsStructGeneratedFromDisjunction():
			for _, field := range resolvedEntrypointType.Struct.Fields {
				newRoot[len(newRoot)-1].TypeHint = &schema.EntryPointType
				arg := ast.Argument{Name: field.Name, Type: field.Type}

				branchOpt := ast.Option{
					Name: field.Name,
					Args: []ast.Argument{arg},
					Assignments: []ast.Assignment{
						ast.ArgumentAssignment(newRoot.AppendStructField(field), arg),
					},
					VeneerTrail: []string{"ComposeBuilders[created]"},
				}

				newBuilder.Options = append(newBuilder.Options, branchOpt)
			}
		case resolvedEntrypointType.IsDisjunction():
			for _, branch := range resolvedEntrypointType.Disjunction.Branches {
				newRoot[len(newRoot)-1].TypeHint = &schema.EntryPointType
				arg := ast.Argument{Name: ast.TypeName(branch), Type: branch}

				branchOpt := ast.Option{
					Name: ast.TypeName(branch),
					Args: []ast.Argument{arg},
					Assignments: []ast.Assignment{
						ast.ArgumentAssignment(newRoot, arg),
					},
					VeneerTrail: []string{"ComposeBuilders[created]"},
				}
				newBuilder.Options = append(newBuilder.Options, branchOpt)
			}
		case resolvedEntrypointType.IsStruct():
			entrypointBuilder, found := composableBuilders.LocateByObject(schema.Package, schema.EntryPoint)
			if !found {
				return nil, fmt.Errorf("builder for schema entrypoint '%s.%s' not found", schema.Package, schema.EntryPoint)
			} else {
				refType := entrypointBuilder.For.SelfRef.AsType()
				newRoot[len(newRoot)-1].TypeHint = &refType

				newBuilder, err = mergeBuilderInto(entrypointBuilder, newBuilder, newRoot, nil, config.RenameOptions)
				if err != nil {
					return nil, err
				}
			}
		default:
			return nil, fmt.Errorf("entrypoint '%s.%s' is a %s: not implemented", schema.Package, schema.EntryPoint, resolvedEntrypointType.Kind)
		}
	}

	composedBuilders = append(composedBuilders, newBuilder)

	return composedBuilders, nil
}

type CompositionConfig struct {
	// SourceBuilderName refers to the builder to use as a source for the
	// composition. Builders for "composable" objects will be composed into
	// this source builder following the mapping defined in the CompositionMap
	// field.
	// Note: The builder name must follow the [package].[builder_name] pattern.
	// Example: "dashboard.Panel"
	SourceBuilderName string

	// PluginDiscriminatorField contains the name of the field used to identify
	// the plugin implementing this object.
	// Example: "type", "kind", ...
	PluginDiscriminatorField string

	// Composition map describes how to perform the composition.
	// Each entry in this map associates a builder (referenced by its name)
	// to a path under witch the assignments should be performed.
	//
	// Example:
	// ```go
	// compositionMap := map[string]string{
	//   "Options": "options",
	//   "FieldConfig": "fieldConfig.defaults.custom",
	// }
	// ```
	CompositionMap map[string]string

	// ExcludeOptions lists option names to exclude in the resulting
	// composed builders.
	ExcludeOptions []string

	// ComposedBuilderName configures the name of the newly composed builders.
	// If left empty, the name is taken from SourceBuilderName.
	ComposedBuilderName string

	// PreserveOriginalBuilders ensures that builders used as part of the
	// composition process are preserved.
	// It is useful when the same builders need to be composed more than once
	// (ex: dashboard and dashboardv2 packages both use Options & FieldConfig
	// types from panels for their composition needs)
	PreserveOriginalBuilders bool

	// RenameOption is used to rename the options from the original schema in order
	// to avoid conflicts with composed builders.
	RenameOptions map[string]string
}

func ComposeBuilders(selector Selector, config CompositionConfig) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		sourceBuilderPkg, sourceBuilderNameWithoutPkg, found := strings.Cut(config.SourceBuilderName, ".")
		if !found {
			return nil, fmt.Errorf("could not apply ComposeBuilders builder veneer: SourceBuilderName '%s' is incorrect: no package found", sourceBuilderPkg)
		}

		sourceBuilder, found := builders.LocateByObject(sourceBuilderPkg, sourceBuilderNameWithoutPkg)
		if !found {
			return builders, nil
		}

		// - add to newBuilders all the builders that are not composable (ie: don't comply to the selector)
		// - build a map of composable builders, indexed by type
		// - aggregate the composable builders into a new, composed builder
		// - add the new composed builders to newBuilders

		newBuilders := make([]ast.Builder, 0, len(builders))
		composableBuilders := make(map[string]ast.Builders)

		for _, builder := range builders {
			// the builder isn't selected: let's leave it untouched
			if !selector(schemas, builder) {
				newBuilders = append(newBuilders, builder)
				continue
			}

			schema, found := schemas.Locate(builder.For.SelfRef.ReferredPkg)
			if !found {
				continue
			}

			panelType := schema.Metadata.Identifier
			composableBuilders[panelType] = append(composableBuilders[panelType], builder)
		}

		for panelType, buildersForType := range composableBuilders {
			composedBuilders, err := composeBuilderForType(schemas, builders, config, panelType, sourceBuilder, buildersForType)
			if err != nil {
				return nil, fmt.Errorf("could not apply ComposeBuilders builder veneer: %w", err)
			}

			for i, b := range composedBuilders {
				b.AddToVeneerTrail(fmt.Sprintf("ComposeBuilders[source=%s]", config.SourceBuilderName))
				composedBuilders[i] = b
			}

			newBuilders = append(newBuilders, composedBuilders...)
		}

		return newBuilders, nil
	}
}

func Rename(selector Selector, newName string) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			builders[i].Name = newName
			builders[i].AddToVeneerTrail("Rename")
		}

		return builders, nil
	}
}

func VeneerTrailAsComments(selector Selector) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			veneerTrail := tools.Map(builder.VeneerTrail, func(veneer string) string {
				return fmt.Sprintf("Modified by veneer '%s'", veneer)
			})

			builders[i].For.Comments = append(builders[i].For.Comments, veneerTrail...)
		}

		return builders, nil
	}
}

func Properties(selector Selector, properties []ast.StructField) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			builders[i].Properties = append(builders[i].Properties, properties...)
			builders[i].AddToVeneerTrail("Properties")
		}

		return builders, nil
	}
}

func Duplicate(selector Selector, duplicateName string, excludeOptions []string) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		var newBuilders ast.Builders

		for _, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			duplicatedBuilder := builder.DeepCopy()
			duplicatedBuilder.Name = duplicateName
			duplicatedBuilder.AddToVeneerTrail(fmt.Sprintf("Duplicate[%s.%s]", builder.Package, builder.Name))

			if len(excludeOptions) != 0 {
				duplicatedBuilder.Options = tools.Filter(duplicatedBuilder.Options, func(option ast.Option) bool {
					return !tools.StringInListEqualFold(option.Name, excludeOptions)
				})
			}

			newBuilders = append(newBuilders, duplicatedBuilder)
		}

		return append(builders, newBuilders...), nil
	}
}

type Initialization struct {
	PropertyPath string
	Value        any
}

func Initialize(selector Selector, statements []Initialization) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			veneerDebug := make([]string, 0, len(statements))
			for _, statement := range statements {
				path, err := builders[i].MakePath(builders, statement.PropertyPath)
				if err != nil {
					return nil, fmt.Errorf("could not apply Initialize builder veneer: %w", err)
				}

				builders[i].Constructor.Assignments = append(builders[i].Constructor.Assignments, ast.ConstantAssignment(path, statement.Value))
				veneerDebug = append(veneerDebug, fmt.Sprintf("%s = %v", statement.PropertyPath, statement.Value))
			}
			builders[i].AddToVeneerTrail(fmt.Sprintf("Initialize[%s]", strings.Join(veneerDebug, ", ")))
		}

		return builders, nil
	}
}

// PromoteOptionsToConstructor promotes the given options as constructor
// parameters. Both arguments and assignments described by the options
// will be exposed in the builder's constructor.
func PromoteOptionsToConstructor(selector Selector, optionNames []string) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			if len(builder.Factories) != 0 {
				return nil, fmt.Errorf("could not apply PromoteOptionsToConstructor builder veneer: constructor arguments can not be added to builders that have factories")
			}

			for _, optName := range optionNames {
				opt, ok := builder.OptionByName(optName)
				if !ok {
					continue
				}

				// TODO: do it for every argument/assignment?
				arg := opt.Args[0].DeepCopy()
				arg.Type.Nullable = false

				builders[i].Constructor.Args = append(builders[i].Constructor.Args, arg)
				builders[i].Constructor.Assignments = append(builders[i].Constructor.Assignments, opt.Assignments[0])

				builders[i].AddToVeneerTrail(fmt.Sprintf("PromoteOptionsToConstructor[%s]", optName))
			}
		}

		return builders, nil
	}
}

// AddOption adds a completely new option to the selected builders.
func AddOption(selector Selector, newOption veneers.Option) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			newOpt, err := newOption.AsIR(schemas, builders, builder)
			if err != nil {
				return nil, fmt.Errorf("could not apply AddOption builder veneer: %w", err)
			}

			newOpt.AddToVeneerTrail("AddOption")
			builders[i].Options = append(builders[i].Options, newOpt)
		}

		return builders, nil
	}
}

// AddFactory adds a builder factory to the selected builders.
// These factories are meant to be used to simplify the instantiation of
// builders for common use-cases.
func AddFactory(selector Selector, factory ast.BuilderFactory) RewriteRule {
	return func(schemas ast.Schemas, builders ast.Builders) (ast.Builders, error) {
		for i, builder := range builders {
			if !selector(schemas, builder) {
				continue
			}

			if len(builder.Constructor.Args) != 0 {
				return nil, fmt.Errorf("could not apply AddFactory builder veneer: builder factories can not be defined on builders that accept parameters in their constructor")
			}

			builders[i].Factories = append(builders[i].Factories, factory)
		}

		return builders, nil
	}
}
