package ast

const (
	// HintDisjunctionOfScalars indicates that the struct was previously
	// represented in the IR by a disjunction of scalars (+ array), the
	// original definition of which is associated to this hint.
	HintDisjunctionOfScalars = "disjunction_of_scalars"

	// HintDiscriminatedDisjunctionOfRefs indicates that the struct was
	// previously represented in the IR by a disjunction of a fixed list of
	// references to structs, the original definition of which is associated
	// to this hint.
	HintDiscriminatedDisjunctionOfRefs = "disjunction_of_refs"

	// HintDisjunctionOfScalarsAndRefs indicates that the struct was
	// previously in the IR by a disjunction of scalars and references
	HintDisjunctionOfScalarsAndRefs = "disjunction_of_scalars_and_refs"

	// HintImplementsVariant indicates that a type implements a variant.
	// ie: dataquery, panelcfg, ...
	HintImplementsVariant = "implements_variant"

	// HintSkipVariantPluginRegistration preserves the variant hint on a type, but
	// tells the jennies to not register it as a plugin.
	HintSkipVariantPluginRegistration = "skip_variant_plugin_registration"

	// HintStringFormatDateTime hints refers to a string that should be formatted
	// as a datetime as defined by RFC 3339, section 5.6 (ex: 2017-07-21T17:32:28Z)
	HintStringFormatDateTime = "string_format_datetime"

	// HintOpenStruct hints that the struct is to be considered open even if not type Any
	// when generating outputs which make explicit allowances for
	// arbitrary additional properties, such as OpenAPI/JSONSchema.
	HintOpenStruct = "open"
)

const DiscriminatorCatchAll = "cog_discriminator_catch_all"
