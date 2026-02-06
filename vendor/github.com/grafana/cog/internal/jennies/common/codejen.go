package common

import (
	"bytes"
	"fmt"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type noopOneToManyJenny[Input any] struct {
}

func (jenny noopOneToManyJenny[Input]) JennyName() string {
	return "noopOneToManyJenny"
}

func (jenny noopOneToManyJenny[Input]) Generate(_ Input) (codejen.Files, error) {
	return nil, nil
}

func If[Input any](condition bool, innerJenny codejen.OneToMany[Input]) codejen.OneToMany[Input] {
	if !condition {
		return noopOneToManyJenny[Input]{}
	}

	return innerJenny
}

// GeneratedCommentHeader produces a FileMapper that injects a comment header onto
// a [codejen.File] indicating  the jenny or jennies that constructed the
// file.
func GeneratedCommentHeader(config languages.Config) codejen.FileMapper {
	genHeader := `{{ .Leader }} Code generated - EDITING IS FUTILE. DO NOT EDIT.
{{- with .Using }}
{{ $.Leader }}
{{ $.Leader }} Using jennies:
{{- range . }}
{{ $.Leader }}     {{ .JennyName }}
{{- end }}
{{- end }}

`

	tmpl, err := template.New("cog").Parse(genHeader)
	if err != nil {
		// not ideal, but also not a big deal: this statement is only reachable when the template is invalid.
		panic(err)
	}

	return func(f codejen.File) (codejen.File, error) {
		var leader string
		switch filepath.Ext(f.RelativePath) {
		case ".ts", ".go", ".java":
			leader = "//"
		case ".yml", ".yaml", ".py":
			leader = "#"
		default:
			leader = ""
		}

		if leader == "" {
			return f, nil
		}

		var from []codejen.NamedJenny
		if config.Debug {
			from = f.From
		}

		buf := new(bytes.Buffer)
		if err := tmpl.Execute(buf, map[string]any{
			"Using":  from,
			"Leader": leader,
		}); err != nil {
			return codejen.File{}, fmt.Errorf("failed executing GeneratedCommentHeader() template: %w", err)
		}
		buf.Write(f.Data)

		f.Data = buf.Bytes()

		return f, nil
	}
}

type pathPrefixerCfg struct {
	except                 []string
	exceptCreatedByJennies []string
}

type PathPrefixerOption func(*pathPrefixerCfg)

func PrefixExcept(pathPrefix ...string) PathPrefixerOption {
	return func(cfg *pathPrefixerCfg) {
		cfg.except = append(cfg.except, pathPrefix...)
	}
}

func ExcludeCreatedByJenny(jennyNames ...string) PathPrefixerOption {
	return func(cfg *pathPrefixerCfg) {
		cfg.exceptCreatedByJennies = append(cfg.exceptCreatedByJennies, jennyNames...)
	}
}

// PathPrefixer returns a FileMapper that injects the provided path prefix to files
// passed through it.
func PathPrefixer(prefix string, opts ...PathPrefixerOption) codejen.FileMapper {
	cfg := &pathPrefixerCfg{}

	for _, opt := range opts {
		opt(cfg)
	}

	return func(f codejen.File) (codejen.File, error) {
		for _, ignoredPrefix := range cfg.except {
			if strings.HasPrefix(f.RelativePath, ignoredPrefix) {
				return f, nil
			}
		}

		createdByJennies := tools.Map(f.From, func(namedJenny codejen.NamedJenny) string {
			return namedJenny.JennyName()
		})
		for _, ignoredJenny := range cfg.exceptCreatedByJennies {
			if tools.ItemInList(ignoredJenny, createdByJennies) {
				return f, nil
			}
		}

		f.RelativePath = filepath.Join(prefix, f.RelativePath)
		return f, nil
	}
}
