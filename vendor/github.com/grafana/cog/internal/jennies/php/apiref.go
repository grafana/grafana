package php

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

func apiReferenceFormatter(tmpl *template.Template, config Config) common.APIReferenceFormatter {
	return common.APIReferenceFormatter{
		KindName: func(kind ast.Kind) string {
			if kind == ast.KindStruct {
				return "class"
			}

			return string(kind)
		},

		FunctionName: func(function common.FunctionReference) string {
			return formatOptionName(function.Name)
		},
		FunctionSignature: func(context languages.Context, function common.FunctionReference) string {
			args := tools.Map(function.Arguments, func(arg common.ArgumentReference) string {
				return fmt.Sprintf("%s $%s", arg.Type, arg.Name)
			})

			return fmt.Sprintf("%[1]s(%[2]s)", formatOptionName(function.Name), strings.Join(args, ", "))
		},

		ObjectName: func(object ast.Object) string {
			return formatObjectName(object.Name)
		},
		ObjectDefinition: func(context languages.Context, object ast.Object) string {
			typesFormatter := defaultTypeFormatter(config, context)
			return typesFormatter.formatTypeDeclaration(tmpl, context, object)
		},

		MethodName: func(method common.MethodReference) string {
			return formatOptionName(method.Name)
		},
		MethodSignature: func(context languages.Context, method common.MethodReference) string {
			args := tools.Map(method.Arguments, func(arg common.ArgumentReference) string {
				return fmt.Sprintf("%s $%s", arg.Type, arg.Name)
			})

			signature := fmt.Sprintf("%[1]s(%[2]s)", formatOptionName(method.Name), strings.Join(args, ", "))
			if method.Static {
				signature = "static " + signature
			}

			return signature
		},

		BuilderName: func(builder ast.Builder) string {
			return formatObjectName(builder.Name) + "Builder"
		},
		ConstructorSignature: func(context languages.Context, builder ast.Builder) string {
			typesFormatter := builderTypeFormatter(config, context)
			args := tools.Map(builder.Constructor.Args, func(arg ast.Argument) string {
				argType := typesFormatter.formatType(arg.Type)
				if argType != "" {
					argType += " "
				}

				return argType + "$" + formatArgName(arg.Name)
			})

			return fmt.Sprintf("new %[1]s(%[2]s)", formatObjectName(builder.Name)+"Builder", strings.Join(args, ", "))
		},
		OptionName: func(option ast.Option) string {
			return formatOptionName(option.Name)
		},
		OptionSignature: func(context languages.Context, builder ast.Builder, option ast.Option) string {
			typesFormatter := builderTypeFormatter(config, context)
			args := tools.Map(option.Args, func(arg ast.Argument) string {
				argType := typesFormatter.formatType(arg.Type)
				if argType != "" {
					argType += " "
				}

				return argType + "$" + formatArgName(arg.Name)
			})

			return fmt.Sprintf("%[1]s(%[2]s)", formatOptionName(option.Name), strings.Join(args, ", "))
		},
	}
}
