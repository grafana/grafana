package template

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

func CustomObjectUnmarshalBlock(obj ast.Object) string {
	return fmt.Sprintf("object_%s_%s_custom_unmarshal", obj.SelfRef.ReferredPkg, obj.SelfRef.ReferredType)
}

func CustomObjectStrictUnmarshalBlock(obj ast.Object) string {
	return fmt.Sprintf("object_%s_%s_custom_strict_unmarshal", obj.SelfRef.ReferredPkg, obj.SelfRef.ReferredType)
}

func ExtraPackageDocsBlock(schema *ast.Schema) string {
	return fmt.Sprintf("api_reference_package_%s_extra", schema.Package)
}

func ExtraObjectDocsBlock(obj ast.Object) string {
	return fmt.Sprintf("api_reference_object_%s_%s_extra", obj.SelfRef.ReferredPkg, obj.SelfRef.ReferredType)
}

func ExtraBuilderDocsBlock(builder ast.Builder) string {
	return fmt.Sprintf("api_reference_builder_%s_%s_extra", builder.Package, builder.Name)
}

func CustomObjectVariantBlock(object ast.Object) string {
	return fmt.Sprintf("object_variant_%s", object.Type.ImplementedVariant())
}

func CustomObjectMethodsBlock(obj ast.Object) string {
	return fmt.Sprintf("object_%s_%s_custom_methods", obj.SelfRef.ReferredPkg, obj.SelfRef.ReferredType)
}

func CustomSchemaVariantBlock(schema *ast.Schema) string {
	return fmt.Sprintf("schema_variant_%s", schema.Metadata.Variant)
}

func VariantFieldUnmarshalBlock(variant string) string {
	return fmt.Sprintf("variant_%s_field_unmarshal", variant)
}

func DynamicFilesBlock() string {
	return "dynamic_files"
}
