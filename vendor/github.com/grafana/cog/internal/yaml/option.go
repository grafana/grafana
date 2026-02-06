package yaml

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/veneers"
	"github.com/grafana/cog/internal/veneers/option"
)

/******************************************************************************
 * Rules
 *****************************************************************************/

type OptionRule struct {
	Omit                    *OptionSelector          `yaml:"omit"`
	Rename                  *RenameOption            `yaml:"rename"`
	RenameArguments         *RenameArguments         `yaml:"rename_arguments"`
	UnfoldBoolean           *UnfoldBoolean           `yaml:"unfold_boolean"`
	StructFieldsAsArguments *StructFieldsAsArguments `yaml:"struct_fields_as_arguments"`
	StructFieldsAsOptions   *StructFieldsAsOptions   `yaml:"struct_fields_as_options"`
	ArrayToAppend           *ArrayToAppend           `yaml:"array_to_append"`
	MapToIndex              *MapToIndex              `yaml:"map_to_index"`
	DisjunctionAsOptions    *DisjunctionAsOptions    `yaml:"disjunction_as_options"`
	Duplicate               *DuplicateOption         `yaml:"duplicate"`
	AddAssignment           *AddAssignment           `yaml:"add_assignment"`
	AddComments             *AddComments             `yaml:"add_comments"`
}

func (rule OptionRule) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	if rule.Omit != nil {
		selector, err := rule.Omit.AsSelector(pkg)
		if err != nil {
			return option.RewriteRule{}, err
		}

		return option.Omit(selector), nil
	}

	if rule.Rename != nil {
		return rule.Rename.AsRewriteRule(pkg)
	}

	if rule.RenameArguments != nil {
		return rule.RenameArguments.AsRewriteRule(pkg)
	}

	if rule.UnfoldBoolean != nil {
		return rule.UnfoldBoolean.AsRewriteRule(pkg)
	}

	if rule.StructFieldsAsArguments != nil {
		return rule.StructFieldsAsArguments.AsRewriteRule(pkg)
	}

	if rule.StructFieldsAsOptions != nil {
		return rule.StructFieldsAsOptions.AsRewriteRule(pkg)
	}

	if rule.ArrayToAppend != nil {
		return rule.ArrayToAppend.AsRewriteRule(pkg)
	}

	if rule.MapToIndex != nil {
		return rule.MapToIndex.AsRewriteRule(pkg)
	}

	if rule.DisjunctionAsOptions != nil {
		return rule.DisjunctionAsOptions.AsRewriteRule(pkg)
	}

	if rule.Duplicate != nil {
		return rule.Duplicate.AsRewriteRule(pkg)
	}

	if rule.AddAssignment != nil {
		return rule.AddAssignment.AsRewriteRule(pkg)
	}

	if rule.AddComments != nil {
		return rule.AddComments.AsRewriteRule(pkg)
	}

	return option.RewriteRule{}, fmt.Errorf("empty rule")
}

type RenameOption struct {
	OptionSelector `yaml:",inline"`

	As string `yaml:"as"`
}

func (rule RenameOption) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.Rename(selector, rule.As), nil
}

type RenameArguments struct {
	OptionSelector `yaml:",inline"`

	As []string `yaml:"as"`
}

func (rule RenameArguments) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.RenameArguments(selector, rule.As), nil
}

type UnfoldBoolean struct {
	OptionSelector `yaml:",inline"`

	TrueAs  string `yaml:"true_as"`
	FalseAs string `yaml:"false_as"`
}

func (rule UnfoldBoolean) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.UnfoldBoolean(selector, option.BooleanUnfold{
		OptionTrue:  rule.TrueAs,
		OptionFalse: rule.FalseAs,
	}), nil
}

type StructFieldsAsArguments struct {
	OptionSelector `yaml:",inline"`
	Fields         []string `yaml:"fields"`
}

func (rule StructFieldsAsArguments) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.StructFieldsAsArguments(selector, rule.Fields...), nil
}

type StructFieldsAsOptions struct {
	OptionSelector `yaml:",inline"`
	Fields         []string `yaml:"fields"`
}

func (rule StructFieldsAsOptions) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.StructFieldsAsOptions(selector, rule.Fields...), nil
}

type ArrayToAppend struct {
	OptionSelector `yaml:",inline"`
}

func (rule ArrayToAppend) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.ArrayToAppend(selector), nil
}

type MapToIndex struct {
	OptionSelector `yaml:",inline"`
}

func (rule MapToIndex) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.MapToIndex(selector), nil
}

type DisjunctionAsOptions struct {
	OptionSelector `yaml:",inline"`
	ArgumentIndex  int `yaml:"argument_index"`
}

func (rule DisjunctionAsOptions) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.DisjunctionAsOptions(selector, rule.ArgumentIndex), nil
}

type DuplicateOption struct {
	OptionSelector `yaml:",inline"`
	As             string `yaml:"as"`
}

func (rule DuplicateOption) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.Duplicate(selector, rule.As), nil
}

type AddAssignment struct {
	OptionSelector `yaml:",inline"`
	Assignment     veneers.Assignment `yaml:"assignment"`
}

func (rule AddAssignment) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.AddAssignment(selector, rule.Assignment), nil
}

type AddComments struct {
	OptionSelector `yaml:",inline"`
	Comments       []string `yaml:"comments"`
}

func (rule AddComments) AsRewriteRule(pkg string) (option.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return option.RewriteRule{}, err
	}

	return option.AddComments(selector, rule.Comments), nil
}

/******************************************************************************
 * Selectors
 *****************************************************************************/

type OptionSelector struct {
	// objectName.optionName
	ByName *string `yaml:"by_name"`

	// builderName.optionName
	// TODO: ByName should be called ByObject
	// and ByBuilder should be called ByName
	ByBuilder *string `yaml:"by_builder"`

	ByNames *ByNamesSelector `yaml:"by_names"`
}

func (selector OptionSelector) AsSelector(pkg string) (option.Selector, error) {
	if selector.ByName != nil {
		objectName, optionName, found := strings.Cut(*selector.ByName, ".")
		if !found {
			return nil, fmt.Errorf("option name '%s' is incorrect: no object name found", *selector.ByName)
		}

		return option.ByName(pkg, objectName, optionName), nil
	}

	if selector.ByBuilder != nil {
		builderName, optionName, found := strings.Cut(*selector.ByBuilder, ".")
		if !found {
			return nil, fmt.Errorf("option name '%s' is incorrect: no builder name found", *selector.ByBuilder)
		}

		return option.ByBuilder(pkg, builderName, optionName), nil
	}

	if selector.ByNames != nil {
		return selector.ByNames.AsSelector(pkg)
	}

	return nil, fmt.Errorf("empty or unknown selector")
}

type ByNamesSelector struct {
	Object  string   `yaml:"object"`
	Builder string   `yaml:"builder"`
	Options []string `yaml:"options"`
}

func (selector ByNamesSelector) AsSelector(pkg string) (option.Selector, error) {
	if selector.Object == "" && selector.Builder == "" {
		return nil, fmt.Errorf("`object` or `builder` is required")
	}

	if selector.Builder != "" {
		return option.ByBuilder(pkg, selector.Builder, selector.Options...), nil
	}

	return option.ByName(pkg, selector.Object, selector.Options...), nil
}
