// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package loads

import "github.com/go-openapi/swag/loading"

type options struct {
	loader         *loader
	loadingOptions []loading.Option
}

func defaultOptions() *options {
	return &options{
		loader: loaders,
	}
}

func loaderFromOptions(options []LoaderOption) *loader {
	opts := defaultOptions()
	for _, apply := range options {
		apply(opts)
	}

	l := opts.loader.clone()
	l.loadingOptions = opts.loadingOptions

	return l
}

// LoaderOption allows to fine-tune the spec loader behavior
type LoaderOption func(*options)

// WithDocLoader sets a custom loader for loading specs
func WithDocLoader(l DocLoader) LoaderOption {
	return func(opt *options) {
		if l == nil {
			return
		}
		opt.loader = &loader{
			DocLoaderWithMatch: DocLoaderWithMatch{
				Fn: l,
			},
		}
	}
}

// WithDocLoaderMatches sets a chain of custom loaders for loading specs
// for different extension matches.
//
// Loaders are executed in the order of provided DocLoaderWithMatch'es.
func WithDocLoaderMatches(l ...DocLoaderWithMatch) LoaderOption {
	return func(opt *options) {
		var final, prev *loader
		for _, ldr := range l {
			if ldr.Fn == nil {
				continue
			}

			if prev == nil {
				final = &loader{DocLoaderWithMatch: ldr}
				prev = final
				continue
			}

			prev = prev.WithNext(&loader{DocLoaderWithMatch: ldr})
		}
		opt.loader = final
	}
}

// WithLoadingOptions adds some [loading.Option] to be added when calling a registered loader.
func WithLoadingOptions(loadingOptions ...loading.Option) LoaderOption {
	return func(opt *options) {
		opt.loadingOptions = loadingOptions
	}
}
