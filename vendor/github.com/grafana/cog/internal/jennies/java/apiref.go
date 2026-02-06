package java

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type APIRef struct {
	config Config
	tmpl   *template.Template
}

func (apiRef *APIRef) apiReferenceFormatter() common.APIReferenceFormatter {
	pkgMapper := func(pkg string, class string) string {
		return pkg
	}

	return common.APIReferenceFormatter{
		KindName: func(kind ast.Kind) string {
			if kind == ast.KindStruct {
				return "class"
			}

			return string(kind)
		},

		FunctionName: func(function common.FunctionReference) string {
			return tools.LowerCamelCase(function.Name)
		},
		FunctionSignature: func(context languages.Context, function common.FunctionReference) string {
			args := tools.Map(function.Arguments, func(arg common.ArgumentReference) string {
				return fmt.Sprintf("%s %s", arg.Type, arg.Name)
			})

			return fmt.Sprintf("public %[1]s(%[2]s)", tools.LowerCamelCase(function.Name), strings.Join(args, ", "))
		},

		ObjectName: func(object ast.Object) string {
			return formatObjectName(object.Name)
		},
		ObjectDefinition: func(context languages.Context, object ast.Object) string {
			typesFormatter := createFormatter(context, apiRef.config).withPackageMapper(pkgMapper)
			return apiRef.definition(typesFormatter, object)
		},

		MethodName: func(method common.MethodReference) string {
			return tools.LowerCamelCase(method.Name)
		},
		MethodSignature: func(context languages.Context, method common.MethodReference) string {
			args := tools.Map(method.Arguments, func(arg common.ArgumentReference) string {
				return fmt.Sprintf("%s %s", arg.Type, arg.Name)
			})

			return fmt.Sprintf("public %[1]s %[2]s(%[3]s)", method.Return, tools.LowerCamelCase(method.Name), strings.Join(args, ", "))
		},

		BuilderName: func(builder ast.Builder) string {
			return formatObjectName(builder.Name) + "Builder"
		},
		ConstructorSignature: func(context languages.Context, builder ast.Builder) string {
			typesFormatter := createFormatter(context, apiRef.config).withPackageMapper(func(pkg string, class string) string {
				return pkg
			})
			args := tools.Map(builder.Constructor.Args, func(arg ast.Argument) string {
				argType := typesFormatter.formatFieldType(arg.Type)
				return argType + " " + formatArgName(arg.Name)
			})

			return fmt.Sprintf("new %[1]s(%[2]s)", formatObjectName(builder.Name)+"Builder", strings.Join(args, ", "))
		},
		OptionName: func(option ast.Option) string {
			return tools.LowerCamelCase(option.Name)
		},
		OptionSignature: func(context languages.Context, builder ast.Builder, option ast.Option) string {
			typesFormatter := createFormatter(context, apiRef.config).withPackageMapper(pkgMapper)
			args := tools.Map(option.Args, func(arg ast.Argument) string {
				argType := typesFormatter.formatBuilderFieldType(arg.Type)
				if argType != "" {
					argType += " "
				}

				return argType + formatArgName(arg.Name)
			})

			return fmt.Sprintf("public %[1]sBuilder %[2]s(%[3]s)", builder.Name, tools.LowerCamelCase(option.Name), strings.Join(args, ", "))
		},
	}
}

func (apiRef *APIRef) definition(typesFormatter *typeFormatter, def ast.Object) string {
	switch def.Type.Kind {
	case ast.KindStruct:
		return apiRef.defineStruct(typesFormatter, def)
	case ast.KindScalar:
		return fmt.Sprintf("public static final %s %s = %v", formatScalarType(def.Type.AsScalar()), def.Name, def.Type.AsScalar().Value)
	case ast.KindRef:
		return fmt.Sprintf("public class %s extends %s {}", def.Name, apiRef.config.formatPackage(def.Type.AsRef().String()))
	case ast.KindEnum:
		b, err := formatEnum(apiRef.config.formatPackage(def.SelfRef.String()), def, apiRef.tmpl)
		if err != nil {
			return ""
		}

		return string(b)
	default:
		fmt.Printf(" not definded: %s\n", def.Type.Kind)
	}

	return ""
}

func (apiRef *APIRef) defineStruct(typesFormatter *typeFormatter, def ast.Object) string {
	buffer := strings.Builder{}

	buffer.WriteString(fmt.Sprintf("public class %s ", tools.UpperCamelCase(def.Name)))
	if def.Type.HasHint(ast.HintImplementsVariant) {
		if def.Type.Hints[ast.HintImplementsVariant] == string(ast.SchemaVariantDataQuery) {
			buffer.WriteString(fmt.Sprintf("extends %s ", apiRef.config.formatPackage("cog.variants.Dataquery")))
		}
	}

	buffer.WriteString("{\n")

	for _, field := range def.Type.AsStruct().Fields {
		buffer.WriteString(fmt.Sprintf("  public %s %s;\n", typesFormatter.formatFieldType(field.Type), formatFieldName(field.Name)))
	}

	buffer.WriteString("}")
	return buffer.String()
}
