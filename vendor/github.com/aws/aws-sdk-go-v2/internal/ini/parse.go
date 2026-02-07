package ini

import (
	"fmt"
	"strings"
)

func parse(tokens []lineToken, path string) Sections {
	parser := &parser{
		path:     path,
		sections: NewSections(),
	}
	parser.parse(tokens)
	return parser.sections
}

type parser struct {
	csection, ckey string   // current state
	path           string   // source file path
	sections       Sections // parse result
}

func (p *parser) parse(tokens []lineToken) {
	for _, otok := range tokens {
		switch tok := otok.(type) {
		case *lineTokenProfile:
			p.handleProfile(tok)
		case *lineTokenProperty:
			p.handleProperty(tok)
		case *lineTokenSubProperty:
			p.handleSubProperty(tok)
		case *lineTokenContinuation:
			p.handleContinuation(tok)
		}
	}
}

func (p *parser) handleProfile(tok *lineTokenProfile) {
	name := tok.Name
	if tok.Type != "" {
		name = fmt.Sprintf("%s %s", tok.Type, tok.Name)
	}
	p.ckey = ""
	p.csection = name
	if _, ok := p.sections.container[name]; !ok {
		p.sections.container[name] = NewSection(name)
	}
}

func (p *parser) handleProperty(tok *lineTokenProperty) {
	if p.csection == "" {
		return // LEGACY: don't error on "global" properties
	}

	p.ckey = tok.Key
	if _, ok := p.sections.container[p.csection].values[tok.Key]; ok {
		section := p.sections.container[p.csection]
		section.Logs = append(p.sections.container[p.csection].Logs,
			fmt.Sprintf(
				"For profile: %v, overriding %v value, with a %v value found in a duplicate profile defined later in the same file %v. \n",
				p.csection, tok.Key, tok.Key, p.path,
			),
		)
		p.sections.container[p.csection] = section
	}

	p.sections.container[p.csection].values[tok.Key] = Value{
		str: tok.Value,
	}
	p.sections.container[p.csection].SourceFile[tok.Key] = p.path
}

func (p *parser) handleSubProperty(tok *lineTokenSubProperty) {
	if p.csection == "" {
		return // LEGACY: don't error on "global" properties
	}

	if p.ckey == "" || p.sections.container[p.csection].values[p.ckey].str != "" {
		// This is an "orphaned" subproperty, either because it's at
		// the beginning of a section or because the last property's
		// value isn't empty. Either way we're lenient here and
		// "promote" this to a normal property.
		p.handleProperty(&lineTokenProperty{
			Key:   tok.Key,
			Value: strings.TrimSpace(trimPropertyComment(tok.Value)),
		})
		return
	}

	if p.sections.container[p.csection].values[p.ckey].mp == nil {
		p.sections.container[p.csection].values[p.ckey] = Value{
			mp: map[string]string{},
		}
	}
	p.sections.container[p.csection].values[p.ckey].mp[tok.Key] = tok.Value
}

func (p *parser) handleContinuation(tok *lineTokenContinuation) {
	if p.ckey == "" {
		return
	}

	value, _ := p.sections.container[p.csection].values[p.ckey]
	if value.str != "" && value.mp == nil {
		value.str = fmt.Sprintf("%s\n%s", value.str, tok.Value)
	}

	p.sections.container[p.csection].values[p.ckey] = value
}
