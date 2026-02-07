// Copyright 2015 Prometheus Team
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

package template

import (
	"bytes"
	tmplhtml "html/template"
	"io"
	"net/url"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	tmpltext "text/template"
	"time"

	"github.com/prometheus/common/model"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	"github.com/prometheus/alertmanager/asset"
	"github.com/prometheus/alertmanager/types"
)

// Template bundles a text and a html template instance.
type Template struct {
	text *tmpltext.Template
	html *tmplhtml.Template

	ExternalURL *url.URL
}

// Option is generic modifier of the text and html templates used by a Template.
type Option func(text *tmpltext.Template, html *tmplhtml.Template)

// New returns a new Template with the DefaultFuncs added. The DefaultFuncs
// have precedence over any added custom functions. Options allow customization
// of the text and html templates in given order.
func New(options ...Option) (*Template, error) {
	t := &Template{
		text: tmpltext.New("").Option("missingkey=zero"),
		html: tmplhtml.New("").Option("missingkey=zero"),
	}

	for _, o := range options {
		o(t.text, t.html)
	}

	t.text.Funcs(tmpltext.FuncMap(DefaultFuncs))
	t.html.Funcs(tmplhtml.FuncMap(DefaultFuncs))

	return t, nil
}

// FromGlobs calls ParseGlob on all path globs provided and returns the
// resulting Template.
func FromGlobs(paths []string, options ...Option) (*Template, error) {
	t, err := New(options...)
	if err != nil {
		return nil, err
	}

	defaultTemplates := []string{"default.tmpl", "email.tmpl"}

	for _, file := range defaultTemplates {
		f, err := asset.Assets.Open(path.Join("/templates", file))
		if err != nil {
			return nil, err
		}
		if err := t.Parse(f); err != nil {
			f.Close()
			return nil, err
		}
		f.Close()
	}

	for _, tp := range paths {
		if err := t.FromGlob(tp); err != nil {
			return nil, err
		}
	}
	return t, nil
}

// Parse parses the given text into the template.
func (t *Template) Parse(r io.Reader) error {
	b, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	if t.text, err = t.text.Parse(string(b)); err != nil {
		return err
	}
	if t.html, err = t.html.Parse(string(b)); err != nil {
		return err
	}
	return nil
}

// FromGlob calls ParseGlob on given path glob provided and parses into the
// template.
func (t *Template) FromGlob(path string) error {
	// ParseGlob in the template packages errors if not at least one file is
	// matched. We want to allow empty matches that may be populated later on.
	p, err := filepath.Glob(path)
	if err != nil {
		return err
	}
	if len(p) > 0 {
		if t.text, err = t.text.ParseGlob(path); err != nil {
			return err
		}
		if t.html, err = t.html.ParseGlob(path); err != nil {
			return err
		}
	}
	return nil
}

// ExecuteTextString needs a meaningful doc comment (TODO(fabxc)).
func (t *Template) ExecuteTextString(text string, data interface{}) (string, error) {
	if text == "" {
		return "", nil
	}
	tmpl, err := t.text.Clone()
	if err != nil {
		return "", err
	}
	tmpl, err = tmpl.New("").Option("missingkey=zero").Parse(text)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	err = tmpl.Execute(&buf, data)
	return buf.String(), err
}

// ExecuteHTMLString needs a meaningful doc comment (TODO(fabxc)).
func (t *Template) ExecuteHTMLString(html string, data interface{}) (string, error) {
	if html == "" {
		return "", nil
	}
	tmpl, err := t.html.Clone()
	if err != nil {
		return "", err
	}
	tmpl, err = tmpl.New("").Option("missingkey=zero").Parse(html)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	err = tmpl.Execute(&buf, data)
	return buf.String(), err
}

type FuncMap map[string]interface{}

var DefaultFuncs = FuncMap{
	"toUpper": strings.ToUpper,
	"toLower": strings.ToLower,
	"title": func(text string) string {
		// Casers should not be shared between goroutines, instead
		// create a new caser each time this function is called.
		return cases.Title(language.AmericanEnglish).String(text)
	},
	"trimSpace": strings.TrimSpace,
	// join is equal to strings.Join but inverts the argument order
	// for easier pipelining in templates.
	"join": func(sep string, s []string) string {
		return strings.Join(s, sep)
	},
	"match": regexp.MatchString,
	"safeHtml": func(text string) tmplhtml.HTML {
		return tmplhtml.HTML(text)
	},
	"reReplaceAll": func(pattern, repl, text string) string {
		re := regexp.MustCompile(pattern)
		return re.ReplaceAllString(text, repl)
	},
	"stringSlice": func(s ...string) []string {
		return s
	},
	// date returns the text representation of the time in the specified format.
	"date": func(fmt string, t time.Time) string {
		return t.Format(fmt)
	},
	// tz returns the time in the timezone.
	"tz": func(name string, t time.Time) (time.Time, error) {
		loc, err := time.LoadLocation(name)
		if err != nil {
			return time.Time{}, err
		}
		return t.In(loc), nil
	},
}

// Pair is a key/value string pair.
type Pair struct {
	Name, Value string
}

// Pairs is a list of key/value string pairs.
type Pairs []Pair

// Names returns a list of names of the pairs.
func (ps Pairs) Names() []string {
	ns := make([]string, 0, len(ps))
	for _, p := range ps {
		ns = append(ns, p.Name)
	}
	return ns
}

// Values returns a list of values of the pairs.
func (ps Pairs) Values() []string {
	vs := make([]string, 0, len(ps))
	for _, p := range ps {
		vs = append(vs, p.Value)
	}
	return vs
}

func (ps Pairs) String() string {
	b := strings.Builder{}
	for i, p := range ps {
		b.WriteString(p.Name)
		b.WriteRune('=')
		b.WriteString(p.Value)
		if i < len(ps)-1 {
			b.WriteString(", ")
		}
	}
	return b.String()
}

// KV is a set of key/value string pairs.
type KV map[string]string

// SortedPairs returns a sorted list of key/value pairs.
func (kv KV) SortedPairs() Pairs {
	var (
		pairs     = make([]Pair, 0, len(kv))
		keys      = make([]string, 0, len(kv))
		sortStart = 0
	)
	for k := range kv {
		if k == string(model.AlertNameLabel) {
			keys = append([]string{k}, keys...)
			sortStart = 1
		} else {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys[sortStart:])

	for _, k := range keys {
		pairs = append(pairs, Pair{k, kv[k]})
	}
	return pairs
}

// Remove returns a copy of the key/value set without the given keys.
func (kv KV) Remove(keys []string) KV {
	keySet := make(map[string]struct{}, len(keys))
	for _, k := range keys {
		keySet[k] = struct{}{}
	}

	res := KV{}
	for k, v := range kv {
		if _, ok := keySet[k]; !ok {
			res[k] = v
		}
	}
	return res
}

// Names returns the names of the label names in the LabelSet.
func (kv KV) Names() []string {
	return kv.SortedPairs().Names()
}

// Values returns a list of the values in the LabelSet.
func (kv KV) Values() []string {
	return kv.SortedPairs().Values()
}

func (kv KV) String() string {
	return kv.SortedPairs().String()
}

// Data is the data passed to notification templates and webhook pushes.
//
// End-users should not be exposed to Go's type system, as this will confuse them and prevent
// simple things like simple equality checks to fail. Map everything to float64/string.
type Data struct {
	Receiver string `json:"receiver"`
	Status   string `json:"status"`
	Alerts   Alerts `json:"alerts"`

	GroupLabels       KV `json:"groupLabels"`
	CommonLabels      KV `json:"commonLabels"`
	CommonAnnotations KV `json:"commonAnnotations"`

	ExternalURL string `json:"externalURL"`
}

// Alert holds one alert for notification templates.
type Alert struct {
	Status       string    `json:"status"`
	Labels       KV        `json:"labels"`
	Annotations  KV        `json:"annotations"`
	StartsAt     time.Time `json:"startsAt"`
	EndsAt       time.Time `json:"endsAt"`
	GeneratorURL string    `json:"generatorURL"`
	Fingerprint  string    `json:"fingerprint"`
}

// Alerts is a list of Alert objects.
type Alerts []Alert

// Firing returns the subset of alerts that are firing.
func (as Alerts) Firing() []Alert {
	res := make([]Alert, 0, len(as))
	for _, a := range as {
		if a.Status == string(model.AlertFiring) {
			res = append(res, a)
		}
	}
	return res
}

// Resolved returns the subset of alerts that are resolved.
func (as Alerts) Resolved() []Alert {
	res := make([]Alert, 0, len(as))
	for _, a := range as {
		if a.Status == string(model.AlertResolved) {
			res = append(res, a)
		}
	}
	return res
}

// Data assembles data for template expansion.
func (t *Template) Data(recv string, groupLabels model.LabelSet, alerts ...*types.Alert) *Data {
	data := &Data{
		Receiver:          regexp.QuoteMeta(recv),
		Status:            string(types.Alerts(alerts...).Status()),
		Alerts:            make(Alerts, 0, len(alerts)),
		GroupLabels:       KV{},
		CommonLabels:      KV{},
		CommonAnnotations: KV{},
		ExternalURL:       t.ExternalURL.String(),
	}

	// The call to types.Alert is necessary to correctly resolve the internal
	// representation to the user representation.
	for _, a := range types.Alerts(alerts...) {
		alert := Alert{
			Status:       string(a.Status()),
			Labels:       make(KV, len(a.Labels)),
			Annotations:  make(KV, len(a.Annotations)),
			StartsAt:     a.StartsAt,
			EndsAt:       a.EndsAt,
			GeneratorURL: a.GeneratorURL,
			Fingerprint:  a.Fingerprint().String(),
		}
		for k, v := range a.Labels {
			alert.Labels[string(k)] = string(v)
		}
		for k, v := range a.Annotations {
			alert.Annotations[string(k)] = string(v)
		}
		data.Alerts = append(data.Alerts, alert)
	}

	for k, v := range groupLabels {
		data.GroupLabels[string(k)] = string(v)
	}

	if len(alerts) >= 1 {
		var (
			commonLabels      = alerts[0].Labels.Clone()
			commonAnnotations = alerts[0].Annotations.Clone()
		)
		for _, a := range alerts[1:] {
			if len(commonLabels) == 0 && len(commonAnnotations) == 0 {
				break
			}
			for ln, lv := range commonLabels {
				if a.Labels[ln] != lv {
					delete(commonLabels, ln)
				}
			}
			for an, av := range commonAnnotations {
				if a.Annotations[an] != av {
					delete(commonAnnotations, an)
				}
			}
		}
		for k, v := range commonLabels {
			data.CommonLabels[string(k)] = string(v)
		}
		for k, v := range commonAnnotations {
			data.CommonAnnotations[string(k)] = string(v)
		}
	}

	return data
}

// Clone returns a copy of the template.
func (t *Template) Clone() (*Template, error) {
	txt, err := t.text.Clone()
	if err != nil {
		return nil, err
	}
	html, err := t.html.Clone()
	if err != nil {
		return nil, err
	}
	var u *url.URL
	if t.ExternalURL != nil {
		u = new(url.URL)
		*u = *t.ExternalURL
	}
	return &Template{
		text:        txt,
		html:        html,
		ExternalURL: u,
	}, nil
}

// HTML returns the clone of HTML template.
func (t *Template) HTML() (*tmplhtml.Template, error) {
	return t.html.Clone()
}

// Text returns the clone of text template.
func (t *Template) Text() (*tmpltext.Template, error) {
	return t.text.Clone()
}
