package transformer

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/hashicorp/go-multierror"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/language/pkg/go/utils"
)

type ModuleFile struct {
	Name     string
	Contents string
}

type ModuleTransformationSingleMetadata struct{}

// ModuleTransformationSingleError is an error occurred during transformation of a module. Line and
// column number provided are one based.
type ModuleTransformationSingleError struct {
	Msg  string
	File string
	Line struct {
		Start int
		End   int
	}
	Column struct {
		Start int
		End   int
	}
}

func (e *ModuleTransformationSingleError) Error() string {
	return fmt.Sprintf("transformation error at line=%d, column=%d: %s", e.Line.Start, e.Column.Start, e.Msg)
}

type ModuleValidationMultipleError multierror.Error

func (e *ModuleValidationMultipleError) Error() string {
	errors := e.Errors

	pluralS := ""
	if len(errors) > 1 {
		pluralS = "s"
	}

	errorsString := []string{}
	for _, item := range errors {
		errorsString = append(errorsString, item.Error())
	}

	return fmt.Sprintf("%d error%s occurred:\n\t* %s\n\n", len(errors), pluralS, strings.Join(errorsString, "\n\t* "))
}

// TransformModuleFilesToModel transforms the provided modules into a singular authorization model.
func TransformModuleFilesToModel( //nolint:funlen,gocognit,cyclop
	modules []ModuleFile,
	schemaVersion string,
) (*openfgav1.AuthorizationModel, error) {
	model := &openfgav1.AuthorizationModel{
		SchemaVersion:   schemaVersion,
		TypeDefinitions: []*openfgav1.TypeDefinition{},
		Conditions:      map[string]*openfgav1.Condition{},
	}

	rawTypeDefs := []*openfgav1.TypeDefinition{}
	types := []string{}
	extendedTypeDefs := map[string][]*openfgav1.TypeDefinition{}
	conditions := map[string]*openfgav1.Condition{}
	moduleFiles := map[string][]string{}

	transformErrors := &multierror.Error{}

	for _, module := range modules {
		lines := strings.Split(module.Contents, "\n")
		moduleFiles[module.Name] = lines

		mdl, typeDefExtensions, err := TransformModularDSLToProto(module.Contents)
		if err != nil {
			var syntaxError *multierror.Error
			if errors.As(err, &syntaxError) {
				transformErrors = multierror.Append(transformErrors, syntaxError.Errors...)
			}

			continue
		}

		for _, typeDef := range mdl.GetTypeDefinitions() {
			_, extension := typeDefExtensions[typeDef.GetType()]
			if slices.Contains(types, typeDef.GetType()) && !extension {
				lineIndex := utils.GetTypeLineNumber(typeDef.GetType(), lines)
				line, col := utils.ConstructLineAndColumnData(lines, lineIndex, typeDef.GetType())

				transformErrors = multierror.Append(transformErrors, &ModuleTransformationSingleError{
					Msg:    "duplicate type definition " + typeDef.GetType(),
					File:   module.Name,
					Line:   line,
					Column: col,
				})

				continue
			}

			if extension {
				if extendedTypeDefs[module.Name] == nil {
					extendedTypeDefs[module.Name] = []*openfgav1.TypeDefinition{}
				}

				extendedTypeDefs[module.Name] = append(extendedTypeDefs[module.Name], typeDef)

				continue
			}

			types = append(types, typeDef.GetType())
			if typeDef.GetMetadata() != nil {
				typeDef.Metadata.SourceInfo = &openfgav1.SourceInfo{
					File: module.Name,
				}
			} else {
				transformErrors = multierror.Append(transformErrors, &ModuleTransformationSingleError{
					Msg: "file is not a module",
				})
				continue
			}
			rawTypeDefs = append(rawTypeDefs, typeDef)
		}

		for name, condition := range mdl.GetConditions() {
			if _, ok := conditions[name]; ok {
				lineIndex := utils.GetConditionLineNumber(name, lines)
				line, col := utils.ConstructLineAndColumnData(lines, lineIndex, name)
				transformErrors = multierror.Append(transformErrors, &ModuleTransformationSingleError{
					Msg:    "duplicate condition " + name,
					File:   module.Name,
					Line:   line,
					Column: col,
				})

				continue
			}

			condition.Metadata.SourceInfo = &openfgav1.SourceInfo{
				File: module.Name,
			}
			conditions[name] = condition
		}
	}

	for filename, typeDefs := range extendedTypeDefs {
		lines := moduleFiles[filename]

		for _, typeDef := range typeDefs {
			originalIndex := slices.IndexFunc(rawTypeDefs, func(t *openfgav1.TypeDefinition) bool {
				return t.GetType() == typeDef.GetType()
			})

			if originalIndex == -1 {
				lineIndex := utils.GetExtendedTypeLineNumber(typeDef.GetType(), lines)
				line, col := utils.ConstructLineAndColumnData(lines, lineIndex, typeDef.GetType())
				transformErrors = multierror.Append(transformErrors, &ModuleTransformationSingleError{
					Msg:    fmt.Sprintf("extended type %s does not exist", typeDef.GetType()),
					File:   filename,
					Line:   line,
					Column: col,
				})

				continue
			}

			original := rawTypeDefs[originalIndex]

			if original.Relations == nil || len(original.GetRelations()) == 0 {
				original.Relations = typeDef.GetRelations()

				if original.GetMetadata() == nil {
					original.Metadata = &openfgav1.Metadata{}
				}

				original.Metadata.Relations = typeDef.GetMetadata().GetRelations()

				if original.Metadata.Relations != nil {
					for name := range original.GetMetadata().GetRelations() {
						original.Metadata.Relations[name].SourceInfo = &openfgav1.SourceInfo{
							File: filename,
						}
					}
				}

				rawTypeDefs[originalIndex] = original

				continue
			}

			existingRelationNames := []string{}
			for name := range original.GetRelations() {
				existingRelationNames = append(existingRelationNames, name)
			}

			for name, relation := range typeDef.GetRelations() {
				if slices.Contains(existingRelationNames, name) {
					lineIndex := utils.GetRelationLineNumber(name, lines)
					line, col := utils.ConstructLineAndColumnData(lines, lineIndex, name)
					transformErrors = multierror.Append(transformErrors, &ModuleTransformationSingleError{
						Msg:    fmt.Sprintf("relation %s already exists on type %s", name, typeDef.GetType()),
						File:   filename,
						Line:   line,
						Column: col,
					})

					continue
				}

				var relationsMeta *openfgav1.RelationMetadata

				for relationMetName, relationM := range typeDef.GetMetadata().GetRelations() {
					if relationMetName == name {
						relationsMeta = relationM

						break
					}
				}

				relationsMeta.SourceInfo = &openfgav1.SourceInfo{
					File: filename,
				}
				original.Relations[name] = relation
				original.Metadata.Relations[name] = relationsMeta
			}
		}
	}

	model.TypeDefinitions = rawTypeDefs
	model.Conditions = conditions

	if len(transformErrors.Errors) != 0 {
		return nil, &ModuleValidationMultipleError{
			Errors: transformErrors.Errors,
		}
	}

	return model, nil
}
