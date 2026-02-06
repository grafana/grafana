package java

import (
	"embed"
	"fmt"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

//go:embed templates/runtime/*.tmpl templates/types/*.tmpl templates/marshalling/*.tmpl templates/converters/*.tmpl templates/builders/*.*
//nolint:gochecknoglobals
var templatesFS embed.FS

func initTemplates(config Config, apiRefCollector *common.APIReferenceCollector) *template.Template {
	tmpl, err := template.New(
		"java",
		template.Funcs(common.TypeResolvingTemplateHelpers(languages.Context{})),
		template.Funcs(common.TypesTemplateHelpers(languages.Context{})),
		template.Funcs(common.APIRefTemplateHelpers(apiRefCollector)),
		template.Funcs(functions()),
		template.Funcs(formattingTemplateFuncs()),

		// parse templates
		template.ParseFS(templatesFS, "templates"),
		template.ParseDirectories(config.OverridesTemplatesDirectories...),
	)
	if err != nil {
		panic(fmt.Errorf("could not initialize templates: %w", err))
	}

	return tmpl
}

func formattingTemplateFuncs() template.FuncMap {
	return template.FuncMap{
		"formatPackageName": formatPackageName,
		"formatObjectName":  formatObjectName,
		"formatArgName":     formatArgName,
		"escapeVar":         escapeVarName,
		"formatScalar":      formatScalar,
		"cleanString":       cleanString,
		"formatIntegerLetter": func(t ast.Type) string {
			switch t.AsScalar().ScalarKind {
			case ast.KindInt64, ast.KindUint64:
				return "L"
			case ast.KindFloat32:
				return "f"
			}
			return ""
		},
	}
}

func functions() template.FuncMap {
	return template.FuncMap{
		"lastPathIdentifier":    lastPathIdentifier,
		"fillAnnotationPattern": fillAnnotationPattern,
		"containsValue":         containsValue,
		"getJavaFieldTypeCheck": getJavaFieldTypeCheck,
		"lastItem": func(index int, values []EnumValue) bool {
			return len(values)-1 == index
		},
		"importStdPkg": func(_ ast.Type) string {
			panic("importStdPkg() needs to be overridden by a jenny")
		},
		"importPkg": func(_ string) string {
			panic("importPkg() needs to be overridden by a jenny")
		},
		"formatPackageName": func(_ ast.Type) string {
			panic("formatPackageName() needs to be overridden by a jenny")
		},
		"formatRawRef": func(_ ast.Type) string {
			panic("formatRawRef() needs to be overridden by a jenny")
		},
		"fillNullableAnnotationPattern": func(_ ast.Type) string {
			panic("fillNullableAnnotationPattern() needs to be overridden by a jenny")
		},
		"formatValue": func(_ ast.Type) string {
			panic("formatValue() needs to be overridden by a jenny")
		},
		"formatPathIndex": func(_ *ast.PathIndex) string {
			panic("formatPathIndex() needs to be overridden by a jenny")
		},
		"formatPath": func(_ ast.Type) string {
			panic("formatPath() needs to be overridden by a jenny")
		},
		"formatAssignmentPath": func(_ ast.Type) string {
			panic("formatAssignmentPath() needs to be overridden by a jenny")
		},
		"formatBuilderFieldType": func(_ ast.Type) string {
			panic("formatBuilderFieldType() needs to be overridden by a jenny")
		},
		"formatType": func(_ ast.Type) string {
			panic("formatType() needs to be overridden by a jenny")
		},
		"typeHasBuilder": func(_ ast.Type) bool {
			panic("typeHasBuilder() needs to be overridden by a jenny")
		},
		"emptyValueForType": func(_ ast.Type) string {
			panic("emptyValueForType() needs to be overridden by a jenny")
		},
		"resolvesToComposableSlot": func(_ ast.Type) bool {
			panic("resolvesToComposableSlot() needs to be overridden by a jenny")
		},
		"formatRefType": func(_ ast.Type, value any) string {
			panic("formatRefType() needs to be overridden by a jenny")
		},
		"formatGuardPath": func(_ ast.Path) string {
			panic("formatGuardPath() needs to be overridden by a jenny")
		},
		"enumFromConstantRef": func(_ ast.Type) string {
			panic("enumFromConstantRef() needs to be overridden by a jenny")
		},
		"factoryClassForPkg": func(_ string) string {
			panic("factoryClassForPkg() needs to be overridden by a jenny")
		},
	}
}

type EnumTemplate struct {
	Package  string
	Name     string
	Values   []EnumValue
	Type     string
	Comments []string
}

type EnumValue struct {
	Name  string
	Value any
}

type ClassTemplate struct {
	Package    string
	RawPackage string
	Imports    fmt.Stringer
	Name       string
	Extends    []string
	Comments   []string

	Fields     []ast.StructField
	Builders   []BuilderTemplate
	HasBuilder bool

	Variant                 string
	Identifier              string
	Annotation              string
	ToJSONFunction          string
	ShouldAddSerializer     bool
	ShouldAddDeserializer   bool
	ShouldAddFactoryMethods bool
	Constructors            []ConstructorTemplate
	ExtraFunctionsBlock     string
}

type ConstructorTemplate struct {
	Args        []ast.Argument
	Assignments []ConstructorAssignmentTemplate
}

type ConstructorAssignmentTemplate struct {
	Name         string
	Type         ast.Type
	Value        any
	ValueFromArg string
}

type ConstantTemplate struct {
	Package   string
	Name      string
	Constants []Constant
}

type Constant struct {
	Name  string
	Type  string
	Value any
}

type BuilderTemplate struct {
	Package              string
	RawPackage           string
	BuilderSignatureType string
	BuilderName          string
	ObjectName           string
	Imports              fmt.Stringer
	ImportAlias          string // alias to the pkg in which the object being built lives.
	Comments             []string
	Constructor          ast.Constructor
	Properties           []ast.StructField
	Options              []ast.Option
	IsGenericPanel       bool
}

type Default struct {
	Name  string
	Value string
}

type DataquerySchema struct {
	Identifier string
	Class      string
	Converter  string
}

type PanelSchema struct {
	Identifier  string
	Options     string
	FieldConfig string
	Converter   string
}

type Unmarshalling struct {
	Package                   string
	Name                      string
	ShouldUnmarshallingPanels bool
	Imports                   fmt.Stringer
	DataqueryUnmarshalling    []DataqueryUnmarshalling
	Fields                    []ast.StructField
	Hint                      any
}

type DataqueryUnmarshalling struct {
	DataqueryHint   string
	IsArray         bool
	DatasourceField string
	FieldName       string
}
