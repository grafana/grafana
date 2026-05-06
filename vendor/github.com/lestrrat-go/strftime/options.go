package strftime

type Option interface {
	Name() string
	Value() interface{}
}

type option struct {
	name  string
	value interface{}
}

func (o *option) Name() string       { return o.name }
func (o *option) Value() interface{} { return o.value }

const optSpecificationSet = `opt-specification-set`

// WithSpecification allows you to specify a custom specification set
func WithSpecificationSet(ds SpecificationSet) Option {
	return &option{
		name:  optSpecificationSet,
		value: ds,
	}
}

type optSpecificationPair struct {
	name     byte
	appender Appender
}

const optSpecification = `opt-specification`

// WithSpecification allows you to create a new specification set on the fly,
// to be used only for that invocation.
func WithSpecification(b byte, a Appender) Option {
	return &option{
		name: optSpecification,
		value: &optSpecificationPair{
			name:     b,
			appender: a,
		},
	}
}

// WithMilliseconds is similar to WithSpecification, and specifies that
// the Strftime object should interpret the pattern `%b` (where b
// is the byte that you specify as the argument)
// as the zero-padded, 3 letter milliseconds of the time.
func WithMilliseconds(b byte) Option {
	return WithSpecification(b, Milliseconds())
}

// WithMicroseconds is similar to WithSpecification, and specifies that
// the Strftime object should interpret the pattern `%b` (where b
// is the byte that you specify as the argument)
// as the zero-padded, 3 letter microseconds of the time.
func WithMicroseconds(b byte) Option {
	return WithSpecification(b, Microseconds())
}

// WithUnixSeconds is similar to WithSpecification, and specifies that
// the Strftime object should interpret the pattern `%b` (where b
// is the byte that you specify as the argument)
// as the unix timestamp in seconds
func WithUnixSeconds(b byte) Option {
	return WithSpecification(b, UnixSeconds())
}
