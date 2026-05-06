package loads

type options struct {
	loader *loader
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

	return opts.loader
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
