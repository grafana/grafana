package common

import (
	"fmt"

	"github.com/grafana/cog/internal/orderedmap"
)

func NoopImportSanitizer(s string) string { return s }

type ImportMapConfig[M any] struct {
	Formatter           func(importMap M) string
	AliasSanitizer      func(string) string
	ImportPathSanitizer func(string) string
	PackagesImportMap   map[string]string
}

type ImportMapOption[M any] func(importMap *ImportMapConfig[M])

func WithAliasSanitizer[M any](sanitizer func(string) string) ImportMapOption[M] {
	return func(importMap *ImportMapConfig[M]) {
		importMap.AliasSanitizer = sanitizer
	}
}

func WithImportPathSanitizer[M any](sanitizer func(string) string) ImportMapOption[M] {
	return func(importMap *ImportMapConfig[M]) {
		importMap.ImportPathSanitizer = sanitizer
	}
}

func WithFormatter[M any](formatter func(M) string) ImportMapOption[M] {
	return func(importMap *ImportMapConfig[M]) {
		importMap.Formatter = formatter
	}
}

func WithPackagesImportMap[M any](packagesImportMap map[string]string) ImportMapOption[M] {
	return func(importMap *ImportMapConfig[M]) {
		if packagesImportMap == nil {
			importMap.PackagesImportMap = map[string]string{}
		} else {
			importMap.PackagesImportMap = packagesImportMap
		}
	}
}

type DirectImportMap struct {
	Imports *orderedmap.Map[string, string] // alias → importPath
	config  ImportMapConfig[DirectImportMap]
}

func NewDirectImportMap(opts ...ImportMapOption[DirectImportMap]) *DirectImportMap {
	config := ImportMapConfig[DirectImportMap]{
		Formatter: func(importMap DirectImportMap) string {
			return fmt.Sprintf("%#v\n", importMap.Imports)
		},
		AliasSanitizer:      NoopImportSanitizer,
		ImportPathSanitizer: NoopImportSanitizer,
		PackagesImportMap:   map[string]string{},
	}

	for _, opt := range opts {
		opt(&config)
	}

	return &DirectImportMap{
		Imports: orderedmap.New[string, string](),
		config:  config,
	}
}

func (im DirectImportMap) IsIdentical(aliasA string, aliasB string) bool {
	return im.config.AliasSanitizer(aliasA) == im.config.AliasSanitizer(aliasB)
}

func (im DirectImportMap) Add(alias string, importPath string) string {
	sanitizedAlias := im.config.AliasSanitizer(alias)

	importPathSanitized := im.config.ImportPathSanitizer(importPath)
	if im.config.PackagesImportMap[sanitizedAlias] != "" {
		importPathSanitized = im.config.PackagesImportMap[alias]
	}

	im.Imports.Set(sanitizedAlias, importPathSanitized)

	return sanitizedAlias
}

func (im DirectImportMap) String() string {
	return im.config.Formatter(im)
}
