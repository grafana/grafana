// Copyright 2015 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package relabel

import (
	"crypto/md5"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/regexp"
	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/model/labels"
)

var (
	// relabelTargetLegacy allows targeting labels with legacy Prometheus character set, plus ${<var>} variables for dynamic characters from source the metrics.
	relabelTargetLegacy = regexp.MustCompile(`^(?:(?:[a-zA-Z_]|\$(?:\{\w+\}|\w+))+\w*)+$`)

	DefaultRelabelConfig = Config{
		Action:      Replace,
		Separator:   ";",
		Regex:       MustNewRegexp("(.*)"),
		Replacement: "$1",
	}
)

// Action is the action to be performed on relabeling.
type Action string

const (
	// Replace performs a regex replacement.
	Replace Action = "replace"
	// Keep drops targets for which the input does not match the regex.
	Keep Action = "keep"
	// Drop drops targets for which the input does match the regex.
	Drop Action = "drop"
	// KeepEqual drops targets for which the input does not match the target.
	KeepEqual Action = "keepequal"
	// DropEqual drops targets for which the input does match the target.
	DropEqual Action = "dropequal"
	// HashMod sets a label to the modulus of a hash of labels.
	HashMod Action = "hashmod"
	// LabelMap copies labels to other labelnames based on a regex.
	LabelMap Action = "labelmap"
	// LabelDrop drops any label matching the regex.
	LabelDrop Action = "labeldrop"
	// LabelKeep drops any label not matching the regex.
	LabelKeep Action = "labelkeep"
	// Lowercase maps input letters to their lower case.
	Lowercase Action = "lowercase"
	// Uppercase maps input letters to their upper case.
	Uppercase Action = "uppercase"
)

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (a *Action) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}
	switch act := Action(strings.ToLower(s)); act {
	case Replace, Keep, Drop, HashMod, LabelMap, LabelDrop, LabelKeep, Lowercase, Uppercase, KeepEqual, DropEqual:
		*a = act
		return nil
	}
	return fmt.Errorf("unknown relabel action %q", s)
}

// Config is the configuration for relabeling of target label sets.
type Config struct {
	// A list of labels from which values are taken and concatenated
	// with the configured separator in order.
	SourceLabels model.LabelNames `yaml:"source_labels,flow,omitempty" json:"sourceLabels,omitempty"`
	// Separator is the string between concatenated values from the source labels.
	Separator string `yaml:"separator,omitempty" json:"separator,omitempty"`
	// Regex against which the concatenation is matched.
	Regex Regexp `yaml:"regex,omitempty" json:"regex,omitempty"`
	// Modulus to take of the hash of concatenated values from the source labels.
	Modulus uint64 `yaml:"modulus,omitempty" json:"modulus,omitempty"`
	// TargetLabel is the label to which the resulting string is written in a replacement.
	// Regexp interpolation is allowed for the replace action.
	TargetLabel string `yaml:"target_label,omitempty" json:"targetLabel,omitempty"`
	// Replacement is the regex replacement pattern to be used.
	Replacement string `yaml:"replacement,omitempty" json:"replacement,omitempty"`
	// Action is the action to be performed for the relabeling.
	Action Action `yaml:"action,omitempty" json:"action,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *Config) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultRelabelConfig
	type plain Config
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.Regex.Regexp == nil {
		c.Regex = MustNewRegexp("")
	}
	return c.Validate()
}

func (c *Config) Validate() error {
	if c.Action == "" {
		return errors.New("relabel action cannot be empty")
	}
	if c.Modulus == 0 && c.Action == HashMod {
		return errors.New("relabel configuration for hashmod requires non-zero modulus")
	}
	if (c.Action == Replace || c.Action == HashMod || c.Action == Lowercase || c.Action == Uppercase || c.Action == KeepEqual || c.Action == DropEqual) && c.TargetLabel == "" {
		return fmt.Errorf("relabel configuration for %s action requires 'target_label' value", c.Action)
	}
	if c.Action == Replace && !varInRegexTemplate(c.TargetLabel) && !model.LabelName(c.TargetLabel).IsValid() {
		return fmt.Errorf("%q is invalid 'target_label' for %s action", c.TargetLabel, c.Action)
	}

	isValidLabelNameWithRegexVarFn := func(value string) bool {
		// UTF-8 allows ${} characters, so standard validation allow $variables by default.
		// TODO(bwplotka): Relabelling users cannot put $ and ${<...>} characters in metric names or values.
		// Design escaping mechanism to allow that, once valid use case appears.
		return model.LabelName(value).IsValid()
	}
	//nolint:staticcheck
	if model.NameValidationScheme == model.LegacyValidation {
		isValidLabelNameWithRegexVarFn = func(value string) bool {
			return relabelTargetLegacy.MatchString(value)
		}
	}
	if c.Action == Replace && varInRegexTemplate(c.TargetLabel) && !isValidLabelNameWithRegexVarFn(c.TargetLabel) {
		return fmt.Errorf("%q is invalid 'target_label' for %s action", c.TargetLabel, c.Action)
	}
	if (c.Action == Lowercase || c.Action == Uppercase || c.Action == KeepEqual || c.Action == DropEqual) && !model.LabelName(c.TargetLabel).IsValid() {
		return fmt.Errorf("%q is invalid 'target_label' for %s action", c.TargetLabel, c.Action)
	}
	if (c.Action == Lowercase || c.Action == Uppercase || c.Action == KeepEqual || c.Action == DropEqual) && c.Replacement != DefaultRelabelConfig.Replacement {
		return fmt.Errorf("'replacement' can not be set for %s action", c.Action)
	}
	if c.Action == LabelMap && !isValidLabelNameWithRegexVarFn(c.Replacement) {
		return fmt.Errorf("%q is invalid 'replacement' for %s action", c.Replacement, c.Action)
	}
	if c.Action == HashMod && !model.LabelName(c.TargetLabel).IsValid() {
		return fmt.Errorf("%q is invalid 'target_label' for %s action", c.TargetLabel, c.Action)
	}

	if c.Action == DropEqual || c.Action == KeepEqual {
		if c.Regex != DefaultRelabelConfig.Regex ||
			c.Modulus != DefaultRelabelConfig.Modulus ||
			c.Separator != DefaultRelabelConfig.Separator ||
			c.Replacement != DefaultRelabelConfig.Replacement {
			return fmt.Errorf("%s action requires only 'source_labels' and `target_label`, and no other fields", c.Action)
		}
	}

	if c.Action == LabelDrop || c.Action == LabelKeep {
		if c.SourceLabels != nil ||
			c.TargetLabel != DefaultRelabelConfig.TargetLabel ||
			c.Modulus != DefaultRelabelConfig.Modulus ||
			c.Separator != DefaultRelabelConfig.Separator ||
			c.Replacement != DefaultRelabelConfig.Replacement {
			return fmt.Errorf("%s action requires only 'regex', and no other fields", c.Action)
		}
	}

	return nil
}

// Regexp encapsulates a regexp.Regexp and makes it YAML marshalable.
type Regexp struct {
	*regexp.Regexp
}

// NewRegexp creates a new anchored Regexp and returns an error if the
// passed-in regular expression does not compile.
func NewRegexp(s string) (Regexp, error) {
	regex, err := regexp.Compile("^(?s:" + s + ")$")
	return Regexp{Regexp: regex}, err
}

// MustNewRegexp works like NewRegexp, but panics if the regular expression does not compile.
func MustNewRegexp(s string) Regexp {
	re, err := NewRegexp(s)
	if err != nil {
		panic(err)
	}
	return re
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (re *Regexp) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}
	r, err := NewRegexp(s)
	if err != nil {
		return err
	}
	*re = r
	return nil
}

// MarshalYAML implements the yaml.Marshaler interface.
func (re Regexp) MarshalYAML() (interface{}, error) {
	if re.String() != "" {
		return re.String(), nil
	}
	return nil, nil
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (re *Regexp) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	r, err := NewRegexp(s)
	if err != nil {
		return err
	}
	*re = r
	return nil
}

// MarshalJSON implements the json.Marshaler interface.
func (re Regexp) MarshalJSON() ([]byte, error) {
	return json.Marshal(re.String())
}

// IsZero implements the yaml.IsZeroer interface.
func (re Regexp) IsZero() bool {
	return re.Regexp == DefaultRelabelConfig.Regex.Regexp
}

// String returns the original string used to compile the regular expression.
func (re Regexp) String() string {
	if re.Regexp == nil {
		return ""
	}

	str := re.Regexp.String()
	// Trim the anchor `^(?s:` prefix and `)$` suffix.
	return str[5 : len(str)-2]
}

// Process returns a relabeled version of the given label set. The relabel configurations
// are applied in order of input.
// There are circumstances where Process will modify the input label.
// If you want to avoid issues with the input label set being modified, at the cost of
// higher memory usage, you can use lbls.Copy().
// If a label set is dropped, EmptyLabels and false is returned.
func Process(lbls labels.Labels, cfgs ...*Config) (ret labels.Labels, keep bool) {
	lb := labels.NewBuilder(lbls)
	if !ProcessBuilder(lb, cfgs...) {
		return labels.EmptyLabels(), false
	}
	return lb.Labels(), true
}

// ProcessBuilder is like Process, but the caller passes a labels.Builder
// containing the initial set of labels, which is mutated by the rules.
func ProcessBuilder(lb *labels.Builder, cfgs ...*Config) (keep bool) {
	for _, cfg := range cfgs {
		keep = relabel(cfg, lb)
		if !keep {
			return false
		}
	}
	return true
}

func relabel(cfg *Config, lb *labels.Builder) (keep bool) {
	var va [16]string
	values := va[:0]
	if len(cfg.SourceLabels) > cap(values) {
		values = make([]string, 0, len(cfg.SourceLabels))
	}
	for _, ln := range cfg.SourceLabels {
		values = append(values, lb.Get(string(ln)))
	}
	val := strings.Join(values, cfg.Separator)

	switch cfg.Action {
	case Drop:
		if cfg.Regex.MatchString(val) {
			return false
		}
	case Keep:
		if !cfg.Regex.MatchString(val) {
			return false
		}
	case DropEqual:
		if lb.Get(cfg.TargetLabel) == val {
			return false
		}
	case KeepEqual:
		if lb.Get(cfg.TargetLabel) != val {
			return false
		}
	case Replace:
		// Fast path to add or delete label pair.
		if val == "" && cfg.Regex == DefaultRelabelConfig.Regex &&
			!varInRegexTemplate(cfg.TargetLabel) && !varInRegexTemplate(cfg.Replacement) {
			lb.Set(cfg.TargetLabel, cfg.Replacement)
			break
		}

		indexes := cfg.Regex.FindStringSubmatchIndex(val)
		// If there is no match no replacement must take place.
		if indexes == nil {
			break
		}
		target := model.LabelName(cfg.Regex.ExpandString([]byte{}, cfg.TargetLabel, val, indexes))
		if !target.IsValid() {
			break
		}
		res := cfg.Regex.ExpandString([]byte{}, cfg.Replacement, val, indexes)
		if len(res) == 0 {
			lb.Del(string(target))
			break
		}
		lb.Set(string(target), string(res))
	case Lowercase:
		lb.Set(cfg.TargetLabel, strings.ToLower(val))
	case Uppercase:
		lb.Set(cfg.TargetLabel, strings.ToUpper(val))
	case HashMod:
		hash := md5.Sum([]byte(val))
		// Use only the last 8 bytes of the hash to give the same result as earlier versions of this code.
		mod := binary.BigEndian.Uint64(hash[8:]) % cfg.Modulus
		lb.Set(cfg.TargetLabel, strconv.FormatUint(mod, 10))
	case LabelMap:
		lb.Range(func(l labels.Label) {
			if cfg.Regex.MatchString(l.Name) {
				res := cfg.Regex.ReplaceAllString(l.Name, cfg.Replacement)
				lb.Set(res, l.Value)
			}
		})
	case LabelDrop:
		lb.Range(func(l labels.Label) {
			if cfg.Regex.MatchString(l.Name) {
				lb.Del(l.Name)
			}
		})
	case LabelKeep:
		lb.Range(func(l labels.Label) {
			if !cfg.Regex.MatchString(l.Name) {
				lb.Del(l.Name)
			}
		})
	default:
		panic(fmt.Errorf("relabel: unknown relabel action type %q", cfg.Action))
	}

	return true
}

func varInRegexTemplate(template string) bool {
	return strings.Contains(template, "$")
}
