// Copyright 2017 The Prometheus Authors
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

package rulefmt

import (
	"bytes"
	"context"
	"io"
	"io/ioutil"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/prometheus/common/model"
	yaml "gopkg.in/yaml.v3"

	"github.com/prometheus/prometheus/pkg/timestamp"
	"github.com/prometheus/prometheus/promql/parser"
	"github.com/prometheus/prometheus/template"
)

// Error represents semantic errors on parsing rule groups.
type Error struct {
	Group    string
	Rule     int
	RuleName string
	Err      WrappedError
}

// WrappedError wraps error with the yaml node which can be used to represent
// the line and column numbers of the error.
type WrappedError struct {
	err     error
	node    *yaml.Node
	nodeAlt *yaml.Node
}

func (err *Error) Error() string {
	if err.Err.nodeAlt != nil {
		return errors.Wrapf(err.Err.err, "%d:%d: %d:%d: group %q, rule %d, %q", err.Err.node.Line, err.Err.node.Column, err.Err.nodeAlt.Line, err.Err.nodeAlt.Column, err.Group, err.Rule, err.RuleName).Error()
	} else if err.Err.node != nil {
		return errors.Wrapf(err.Err.err, "%d:%d: group %q, rule %d, %q", err.Err.node.Line, err.Err.node.Column, err.Group, err.Rule, err.RuleName).Error()
	}
	return errors.Wrapf(err.Err.err, "group %q, rule %d, %q", err.Group, err.Rule, err.RuleName).Error()
}

// RuleGroups is a set of rule groups that are typically exposed in a file.
type RuleGroups struct {
	Groups []RuleGroup `yaml:"groups"`
}

type ruleGroups struct {
	Groups []yaml.Node `yaml:"groups"`
}

// Validate validates all rules in the rule groups.
func (g *RuleGroups) Validate(node ruleGroups) (errs []error) {
	set := map[string]struct{}{}

	for j, g := range g.Groups {
		if g.Name == "" {
			errs = append(errs, errors.Errorf("%d:%d: Groupname must not be empty", node.Groups[j].Line, node.Groups[j].Column))
		}

		if _, ok := set[g.Name]; ok {
			errs = append(
				errs,
				errors.Errorf("%d:%d: groupname: \"%s\" is repeated in the same file", node.Groups[j].Line, node.Groups[j].Column, g.Name),
			)
		}

		set[g.Name] = struct{}{}

		for i, r := range g.Rules {
			for _, node := range r.Validate() {
				var ruleName yaml.Node
				if r.Alert.Value != "" {
					ruleName = r.Alert
				} else {
					ruleName = r.Record
				}
				errs = append(errs, &Error{
					Group:    g.Name,
					Rule:     i + 1,
					RuleName: ruleName.Value,
					Err:      node,
				})
			}
		}
	}

	return errs
}

// RuleGroup is a list of sequentially evaluated recording and alerting rules.
type RuleGroup struct {
	Name     string         `yaml:"name"`
	Interval model.Duration `yaml:"interval,omitempty"`
	Rules    []RuleNode     `yaml:"rules"`
}

// Rule describes an alerting or recording rule.
type Rule struct {
	Record      string            `yaml:"record,omitempty"`
	Alert       string            `yaml:"alert,omitempty"`
	Expr        string            `yaml:"expr"`
	For         model.Duration    `yaml:"for,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations,omitempty"`
}

// RuleNode adds yaml.v3 layer to support line and column outputs for invalid rules.
type RuleNode struct {
	Record      yaml.Node         `yaml:"record,omitempty"`
	Alert       yaml.Node         `yaml:"alert,omitempty"`
	Expr        yaml.Node         `yaml:"expr"`
	For         model.Duration    `yaml:"for,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations,omitempty"`
}

// Validate the rule and return a list of encountered errors.
func (r *RuleNode) Validate() (nodes []WrappedError) {
	if r.Record.Value != "" && r.Alert.Value != "" {
		nodes = append(nodes, WrappedError{
			err:     errors.Errorf("only one of 'record' and 'alert' must be set"),
			node:    &r.Record,
			nodeAlt: &r.Alert,
		})
	}
	if r.Record.Value == "" && r.Alert.Value == "" {
		if r.Record.Value == "0" {
			nodes = append(nodes, WrappedError{
				err:  errors.Errorf("one of 'record' or 'alert' must be set"),
				node: &r.Alert,
			})
		} else {
			nodes = append(nodes, WrappedError{
				err:  errors.Errorf("one of 'record' or 'alert' must be set"),
				node: &r.Record,
			})
		}
	}

	if r.Expr.Value == "" {
		nodes = append(nodes, WrappedError{
			err:  errors.Errorf("field 'expr' must be set in rule"),
			node: &r.Expr,
		})
	} else if _, err := parser.ParseExpr(r.Expr.Value); err != nil {
		nodes = append(nodes, WrappedError{
			err:  errors.Wrapf(err, "could not parse expression"),
			node: &r.Expr,
		})
	}
	if r.Record.Value != "" {
		if len(r.Annotations) > 0 {
			nodes = append(nodes, WrappedError{
				err:  errors.Errorf("invalid field 'annotations' in recording rule"),
				node: &r.Record,
			})
		}
		if r.For != 0 {
			nodes = append(nodes, WrappedError{
				err:  errors.Errorf("invalid field 'for' in recording rule"),
				node: &r.Record,
			})
		}
		if !model.IsValidMetricName(model.LabelValue(r.Record.Value)) {
			nodes = append(nodes, WrappedError{
				err:  errors.Errorf("invalid recording rule name: %s", r.Record.Value),
				node: &r.Record,
			})
		}
	}

	for k, v := range r.Labels {
		if !model.LabelName(k).IsValid() || k == model.MetricNameLabel {
			nodes = append(nodes, WrappedError{
				err: errors.Errorf("invalid label name: %s", k),
			})
		}

		if !model.LabelValue(v).IsValid() {
			nodes = append(nodes, WrappedError{
				err: errors.Errorf("invalid label value: %s", v),
			})
		}
	}

	for k := range r.Annotations {
		if !model.LabelName(k).IsValid() {
			nodes = append(nodes, WrappedError{
				err: errors.Errorf("invalid annotation name: %s", k),
			})
		}
	}

	for _, err := range testTemplateParsing(r) {
		nodes = append(nodes, WrappedError{err: err})
	}

	return
}

// testTemplateParsing checks if the templates used in labels and annotations
// of the alerting rules are parsed correctly.
func testTemplateParsing(rl *RuleNode) (errs []error) {
	if rl.Alert.Value == "" {
		// Not an alerting rule.
		return errs
	}

	// Trying to parse templates.
	tmplData := template.AlertTemplateData(map[string]string{}, map[string]string{}, 0)
	defs := []string{
		"{{$labels := .Labels}}",
		"{{$externalLabels := .ExternalLabels}}",
		"{{$value := .Value}}",
	}
	parseTest := func(text string) error {
		tmpl := template.NewTemplateExpander(
			context.TODO(),
			strings.Join(append(defs, text), ""),
			"__alert_"+rl.Alert.Value,
			tmplData,
			model.Time(timestamp.FromTime(time.Now())),
			nil,
			nil,
		)
		return tmpl.ParseTest()
	}

	// Parsing Labels.
	for k, val := range rl.Labels {
		err := parseTest(val)
		if err != nil {
			errs = append(errs, errors.Wrapf(err, "label %q", k))
		}
	}

	// Parsing Annotations.
	for k, val := range rl.Annotations {
		err := parseTest(val)
		if err != nil {
			errs = append(errs, errors.Wrapf(err, "annotation %q", k))
		}
	}

	return errs
}

// Parse parses and validates a set of rules.
func Parse(content []byte) (*RuleGroups, []error) {
	var (
		groups RuleGroups
		node   ruleGroups
		errs   []error
	)

	decoder := yaml.NewDecoder(bytes.NewReader(content))
	decoder.KnownFields(true)
	err := decoder.Decode(&groups)
	// Ignore io.EOF which happens with empty input.
	if err != nil && err != io.EOF {
		errs = append(errs, err)
	}
	err = yaml.Unmarshal(content, &node)
	if err != nil {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return nil, errs
	}

	return &groups, groups.Validate(node)
}

// ParseFile reads and parses rules from a file.
func ParseFile(file string) (*RuleGroups, []error) {
	b, err := ioutil.ReadFile(file)
	if err != nil {
		return nil, []error{errors.Wrap(err, file)}
	}
	rgs, errs := Parse(b)
	for i := range errs {
		errs[i] = errors.Wrap(errs[i], file)
	}
	return rgs, errs
}
