package yaml

import (
	"fmt"
	"io"
	"os"

	"github.com/grafana/cog/internal/veneers/builder"
	"github.com/grafana/cog/internal/veneers/option"
	"github.com/grafana/cog/internal/veneers/rewrite"
	"gopkg.in/yaml.v3"
)

type Veneers struct {
	Language string        `yaml:"language"`
	Package  string        `yaml:"package"`
	Builders []BuilderRule `yaml:"builders"`
	Options  []OptionRule  `yaml:"options"`
}

type VeneersLoader struct {
}

func NewVeneersLoader() *VeneersLoader {
	return &VeneersLoader{}
}

func (loader *VeneersLoader) RewriterFrom(filenames []string, config rewrite.Config) (*rewrite.Rewriter, error) {
	languageRules := make([]rewrite.LanguageRules, 0, len(filenames))

	for _, filename := range filenames {
		reader, err := os.Open(filename)
		if err != nil {
			return nil, err
		}
		defer reader.Close()

		rules, err := loader.load(reader)
		if err != nil {
			return nil, fmt.Errorf("could not load '%s': %w", filename, err)
		}

		languageRules = append(languageRules, rules)
	}

	return rewrite.NewRewrite(languageRules, config), nil
}

func (loader *VeneersLoader) load(reader io.Reader) (rewrite.LanguageRules, error) {
	var builderRules []builder.RewriteRule
	var optionRules []option.RewriteRule

	veneers := &Veneers{}

	decoder := yaml.NewDecoder(reader)
	decoder.KnownFields(true)

	if err := decoder.Decode(&veneers); err != nil {
		return rewrite.LanguageRules{}, err
	}

	if veneers.Package == "" {
		return rewrite.LanguageRules{}, fmt.Errorf("missing 'package' statement in veneers file '%s'", reader)
	}

	builderRules = make([]builder.RewriteRule, 0, len(veneers.Builders))
	optionRules = make([]option.RewriteRule, 0, len(veneers.Options))

	// convert builder rules
	for _, rule := range veneers.Builders {
		builderRule, err := rule.AsRewriteRule(veneers.Package)
		if err != nil {
			return rewrite.LanguageRules{}, err
		}

		builderRules = append(builderRules, builderRule)
	}

	// convert option rules
	for _, rule := range veneers.Options {
		optionRule, err := rule.AsRewriteRule(veneers.Package)
		if err != nil {
			return rewrite.LanguageRules{}, err
		}

		optionRules = append(optionRules, optionRule)
	}

	return rewrite.LanguageRules{
		Language:     veneers.Language,
		BuilderRules: builderRules,
		OptionRules:  optionRules,
	}, nil
}
