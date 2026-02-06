package sourcemap

import (
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"sort"
)

type sourceMap struct {
	Version        int               `json:"version"`
	File           string            `json:"file"`
	SourceRoot     string            `json:"sourceRoot"`
	Sources        []string          `json:"sources"`
	SourcesContent []string          `json:"sourcesContent"`
	Names          []json.RawMessage `json:"names,string"`
	Mappings       string            `json:"mappings"`

	mappings []mapping
}

type v3 struct {
	sourceMap
	Sections []section `json:"sections"`
}

func (m *sourceMap) parse(sourcemapURL string) error {
	if err := checkVersion(m.Version); err != nil {
		return err
	}

	var sourceRootURL *url.URL
	if m.SourceRoot != "" {
		u, err := url.Parse(m.SourceRoot)
		if err != nil {
			return err
		}
		if u.IsAbs() {
			sourceRootURL = u
		}
	} else if sourcemapURL != "" {
		u, err := url.Parse(sourcemapURL)
		if err != nil {
			return err
		}
		if u.IsAbs() {
			u.Path = path.Dir(u.Path)
			sourceRootURL = u
		}
	}

	for i, src := range m.Sources {
		m.Sources[i] = m.absSource(sourceRootURL, src)
	}

	mappings, err := parseMappings(m.Mappings)
	if err != nil {
		return err
	}

	m.mappings = mappings
	// Free memory.
	m.Mappings = ""

	return nil
}

func (m *sourceMap) absSource(root *url.URL, source string) string {
	if path.IsAbs(source) {
		return source
	}

	if u, err := url.Parse(source); err == nil && u.IsAbs() {
		return source
	}

	if root != nil {
		u := *root
		u.Path = path.Join(u.Path, source)
		return u.String()
	}

	if m.SourceRoot != "" {
		return path.Join(m.SourceRoot, source)
	}

	return source
}

func (m *sourceMap) name(idx int) string {
	if idx >= len(m.Names) {
		return ""
	}

	raw := m.Names[idx]
	if len(raw) == 0 {
		return ""
	}

	if raw[0] == '"' && raw[len(raw)-1] == '"' {
		var str string
		if err := json.Unmarshal(raw, &str); err == nil {
			return str
		}
	}

	return string(raw)
}

type section struct {
	Offset struct {
		Line   int `json:"line"`
		Column int `json:"column"`
	} `json:"offset"`
	Map *sourceMap `json:"map"`
}

type Consumer struct {
	sourcemapURL string
	file         string
	sections     []section
}

func Parse(sourcemapURL string, b []byte) (*Consumer, error) {
	v3 := new(v3)
	err := json.Unmarshal(b, v3)
	if err != nil {
		return nil, err
	}

	if err := checkVersion(v3.Version); err != nil {
		return nil, err
	}

	if len(v3.Sections) == 0 {
		v3.Sections = append(v3.Sections, section{
			Map: &v3.sourceMap,
		})
	}

	for _, s := range v3.Sections {
		err := s.Map.parse(sourcemapURL)
		if err != nil {
			return nil, err
		}
	}

	reverse(v3.Sections)
	return &Consumer{
		sourcemapURL: sourcemapURL,
		file:         v3.File,
		sections:     v3.Sections,
	}, nil
}

func (c *Consumer) SourcemapURL() string {
	return c.sourcemapURL
}

// File returns an optional name of the generated code
// that this source map is associated with.
func (c *Consumer) File() string {
	return c.file
}

// Source returns the original source, name, line, and column information
// for the generated source's line and column positions.
func (c *Consumer) Source(
	genLine, genColumn int,
) (source, name string, line, column int, ok bool) {
	for i := range c.sections {
		s := &c.sections[i]
		if s.Offset.Line < genLine ||
			(s.Offset.Line+1 == genLine && s.Offset.Column <= genColumn) {
			genLine -= s.Offset.Line
			genColumn -= s.Offset.Column
			return c.source(s.Map, genLine, genColumn)
		}
	}
	return
}

func (c *Consumer) source(
	m *sourceMap, genLine, genColumn int,
) (source, name string, line, column int, ok bool) {
	if len(m.mappings) == 0 {
		return
	}

	i := sort.Search(len(m.mappings), func(i int) bool {
		m := &m.mappings[i]
		if int(m.genLine) == genLine {
			return int(m.genColumn) >= genColumn
		}
		return int(m.genLine) >= genLine
	})

	var match *mapping
	// Mapping not found
	if i == len(m.mappings) {
		// lets see if the line is correct but the column is bigger
		match = &m.mappings[i-1]
		if int(match.genLine) != genLine {
			return
		}
	} else {
		match = &m.mappings[i]

		// Fuzzy match.
		if int(match.genLine) > genLine || int(match.genColumn) > genColumn {
			if i == 0 {
				return
			}
			match = &m.mappings[i-1]
		}
	}

	if match.sourcesInd >= 0 {
		source = m.Sources[match.sourcesInd]
	}
	if match.namesInd >= 0 {
		name = m.name(int(match.namesInd))
	}
	line = int(match.sourceLine)
	column = int(match.sourceColumn)
	ok = true
	return
}

// SourceContent returns the original source content for the source.
func (c *Consumer) SourceContent(source string) string {
	for i := range c.sections {
		s := &c.sections[i]
		for i, src := range s.Map.Sources {
			if src == source {
				if i < len(s.Map.SourcesContent) {
					return s.Map.SourcesContent[i]
				}
				break
			}
		}
	}
	return ""
}

func checkVersion(version int) error {
	if version == 3 || version == 0 {
		return nil
	}
	return fmt.Errorf(
		"sourcemap: got version=%d, but only 3rd version is supported",
		version,
	)
}

func reverse(ss []section) {
	last := len(ss) - 1
	for i := 0; i < len(ss)/2; i++ {
		ss[i], ss[last-i] = ss[last-i], ss[i]
	}
}
