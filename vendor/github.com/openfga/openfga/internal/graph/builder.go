package graph

type CheckResolverOrderedBuilder struct {
	resolvers                              []CheckResolver
	localCheckerOptions                    []LocalCheckerOption
	shadowLocalCheckerOptions              []LocalCheckerOption
	shadowResolverEnabled                  bool
	shadowResolverOptions                  []ShadowResolverOpt
	cachedCheckResolverEnabled             bool
	cachedCheckResolverOptions             []CachedCheckResolverOpt
	dispatchThrottlingCheckResolverEnabled bool
	dispatchThrottlingCheckResolverOptions []DispatchThrottlingCheckResolverOpt
}

type CheckResolverOrderedBuilderOpt func(checkResolver *CheckResolverOrderedBuilder)

// WithLocalCheckerOpts sets the opts to be used to build LocalChecker.
func WithLocalCheckerOpts(opts ...LocalCheckerOption) CheckResolverOrderedBuilderOpt {
	return func(r *CheckResolverOrderedBuilder) {
		r.localCheckerOptions = opts
	}
}

func WithLocalShadowCheckerOpts(opts ...LocalCheckerOption) CheckResolverOrderedBuilderOpt {
	return func(r *CheckResolverOrderedBuilder) {
		r.shadowLocalCheckerOptions = opts
	}
}

func WithShadowResolverEnabled(enabled bool) CheckResolverOrderedBuilderOpt {
	return func(r *CheckResolverOrderedBuilder) {
		r.shadowResolverEnabled = enabled
	}
}

func WithShadowResolverOpts(opts ...ShadowResolverOpt) CheckResolverOrderedBuilderOpt {
	return func(r *CheckResolverOrderedBuilder) {
		r.shadowResolverOptions = opts
	}
}

// WithCachedCheckResolverOpts sets the opts to be used to build CachedCheckResolver.
func WithCachedCheckResolverOpts(enabled bool, opts ...CachedCheckResolverOpt) CheckResolverOrderedBuilderOpt {
	return func(r *CheckResolverOrderedBuilder) {
		r.cachedCheckResolverEnabled = enabled
		r.cachedCheckResolverOptions = opts
	}
}

// WithDispatchThrottlingCheckResolverOpts sets the opts to be used to build DispatchThrottlingCheckResolver.
func WithDispatchThrottlingCheckResolverOpts(enabled bool, opts ...DispatchThrottlingCheckResolverOpt) CheckResolverOrderedBuilderOpt {
	return func(r *CheckResolverOrderedBuilder) {
		r.dispatchThrottlingCheckResolverEnabled = enabled
		r.dispatchThrottlingCheckResolverOptions = opts
	}
}

func NewOrderedCheckResolvers(opts ...CheckResolverOrderedBuilderOpt) *CheckResolverOrderedBuilder {
	checkResolverBuilder := &CheckResolverOrderedBuilder{}
	for _, opt := range opts {
		opt(checkResolverBuilder)
	}
	return checkResolverBuilder
}

// Build constructs a CheckResolver that is composed of various CheckResolvers in the manner of a circular linked list.
// The resolvers should be added from least resource intensive to most resource intensive.
//
//	[...Other resolvers depending on the opts order]
//		LocalChecker    ----------------------------^
//
// The returned CheckResolverCloser should be used to close all resolvers involved in the list.
func (c *CheckResolverOrderedBuilder) Build() (CheckResolver, CheckResolverCloser, error) {
	c.resolvers = []CheckResolver{}

	if c.cachedCheckResolverEnabled {
		cachedCheckResolver, err := NewCachedCheckResolver(c.cachedCheckResolverOptions...)
		if err != nil {
			return nil, nil, err
		}

		c.resolvers = append(c.resolvers, cachedCheckResolver)
	}

	if c.dispatchThrottlingCheckResolverEnabled {
		c.resolvers = append(c.resolvers, NewDispatchThrottlingCheckResolver(c.dispatchThrottlingCheckResolverOptions...))
	}

	if c.shadowResolverEnabled {
		main := NewLocalChecker(c.localCheckerOptions...)
		shadow := NewLocalChecker(c.shadowLocalCheckerOptions...)
		c.resolvers = append(c.resolvers, NewShadowChecker(main, shadow, c.shadowResolverOptions...))
	} else {
		c.resolvers = append(c.resolvers, NewLocalChecker(c.localCheckerOptions...))
	}

	for i, resolver := range c.resolvers {
		if i == len(c.resolvers)-1 {
			resolver.SetDelegate(c.resolvers[0])
			continue
		}
		resolver.SetDelegate(c.resolvers[i+1])
	}

	return c.resolvers[0], c.close, nil
}

// close will ensure all the CheckResolver constructed are closed.
func (c *CheckResolverOrderedBuilder) close() {
	for _, resolver := range c.resolvers {
		resolver.Close()
	}
}

// LocalCheckResolver returns the local checker in the chain of CheckResolver.
func LocalCheckResolver(resolver CheckResolver) (*LocalChecker, bool) {
	if resolver == nil {
		return nil, false
	}
	localChecker, ok := resolver.(*LocalChecker)
	if ok {
		return localChecker, true
	}
	shadowChecker, ok := resolver.(*ShadowResolver)
	if ok {
		return LocalCheckResolver(shadowChecker.main)
	}
	delegate := resolver.GetDelegate()
	if delegate != nil {
		if delegate == resolver {
			// this handles the case where the delegate is itself (to avoid the problem of infinite loop)
			return nil, false
		}
		return LocalCheckResolver(delegate)
	}
	return nil, false
}
