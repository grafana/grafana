package flags

import (
	"bytes"
	"fmt"
	"os"
	"reflect"
	"strings"
	"unicode/utf8"
)

// Option flag information. Contains a description of the option, short and
// long name as well as a default value and whether an argument for this
// flag is optional.
type Option struct {
	// The description of the option flag. This description is shown
	// automatically in the built-in help.
	Description string

	// The short name of the option (a single character). If not 0, the
	// option flag can be 'activated' using -<ShortName>. Either ShortName
	// or LongName needs to be non-empty.
	ShortName rune

	// The long name of the option. If not "", the option flag can be
	// activated using --<LongName>. Either ShortName or LongName needs
	// to be non-empty.
	LongName string

	// The default value of the option.
	Default []string

	// The optional environment default value key name.
	EnvDefaultKey string

	// The optional delimiter string for EnvDefaultKey values.
	EnvDefaultDelim string

	// If true, specifies that the argument to an option flag is optional.
	// When no argument to the flag is specified on the command line, the
	// value of OptionalValue will be set in the field this option represents.
	// This is only valid for non-boolean options.
	OptionalArgument bool

	// The optional value of the option. The optional value is used when
	// the option flag is marked as having an OptionalArgument. This means
	// that when the flag is specified, but no option argument is given,
	// the value of the field this option represents will be set to
	// OptionalValue. This is only valid for non-boolean options.
	OptionalValue []string

	// If true, the option _must_ be specified on the command line. If the
	// option is not specified, the parser will generate an ErrRequired type
	// error.
	Required bool

	// A name for the value of an option shown in the Help as --flag [ValueName]
	ValueName string

	// A mask value to show in the help instead of the default value. This
	// is useful for hiding sensitive information in the help, such as
	// passwords.
	DefaultMask string

	// If non empty, only a certain set of values is allowed for an option.
	Choices []string

	// If true, the option is not displayed in the help or man page
	Hidden bool

	// The group which the option belongs to
	group *Group

	// The struct field which the option represents.
	field reflect.StructField

	// The struct field value which the option represents.
	value reflect.Value

	// Determines if the option will be always quoted in the INI output
	iniQuote bool

	tag                     multiTag
	isSet                   bool
	isSetDefault            bool
	preventDefault          bool
	clearReferenceBeforeSet bool

	defaultLiteral string
}

// LongNameWithNamespace returns the option's long name with the group namespaces
// prepended by walking up the option's group tree. Namespaces and the long name
// itself are separated by the parser's namespace delimiter. If the long name is
// empty an empty string is returned.
func (option *Option) LongNameWithNamespace() string {
	if len(option.LongName) == 0 {
		return ""
	}

	// fetch the namespace delimiter from the parser which is always at the
	// end of the group hierarchy
	namespaceDelimiter := ""
	g := option.group

	for {
		if p, ok := g.parent.(*Parser); ok {
			namespaceDelimiter = p.NamespaceDelimiter

			break
		}

		switch i := g.parent.(type) {
		case *Command:
			g = i.Group
		case *Group:
			g = i
		}
	}

	// concatenate long name with namespace
	longName := option.LongName
	g = option.group

	for g != nil {
		if g.Namespace != "" {
			longName = g.Namespace + namespaceDelimiter + longName
		}

		switch i := g.parent.(type) {
		case *Command:
			g = i.Group
		case *Group:
			g = i
		case *Parser:
			g = nil
		}
	}

	return longName
}

// EnvKeyWithNamespace returns the option's env key with the group namespaces
// prepended by walking up the option's group tree. Namespaces and the env key
// itself are separated by the parser's namespace delimiter. If the env key is
// empty an empty string is returned.
func (option *Option) EnvKeyWithNamespace() string {
	if len(option.EnvDefaultKey) == 0 {
		return ""
	}

	// fetch the namespace delimiter from the parser which is always at the
	// end of the group hierarchy
	namespaceDelimiter := ""
	g := option.group

	for {
		if p, ok := g.parent.(*Parser); ok {
			namespaceDelimiter = p.EnvNamespaceDelimiter

			break
		}

		switch i := g.parent.(type) {
		case *Command:
			g = i.Group
		case *Group:
			g = i
		}
	}

	// concatenate long name with namespace
	key := option.EnvDefaultKey
	g = option.group

	for g != nil {
		if g.EnvNamespace != "" {
			key = g.EnvNamespace + namespaceDelimiter + key
		}

		switch i := g.parent.(type) {
		case *Command:
			g = i.Group
		case *Group:
			g = i
		case *Parser:
			g = nil
		}
	}

	return key
}

// String converts an option to a human friendly readable string describing the
// option.
func (option *Option) String() string {
	var s string
	var short string

	if option.ShortName != 0 {
		data := make([]byte, utf8.RuneLen(option.ShortName))
		utf8.EncodeRune(data, option.ShortName)
		short = string(data)

		if len(option.LongName) != 0 {
			s = fmt.Sprintf("%s%s, %s%s",
				string(defaultShortOptDelimiter), short,
				defaultLongOptDelimiter, option.LongNameWithNamespace())
		} else {
			s = fmt.Sprintf("%s%s", string(defaultShortOptDelimiter), short)
		}
	} else if len(option.LongName) != 0 {
		s = fmt.Sprintf("%s%s", defaultLongOptDelimiter, option.LongNameWithNamespace())
	}

	return s
}

// Value returns the option value as an interface{}.
func (option *Option) Value() interface{} {
	return option.value.Interface()
}

// Field returns the reflect struct field of the option.
func (option *Option) Field() reflect.StructField {
	return option.field
}

// IsSet returns true if option has been set
func (option *Option) IsSet() bool {
	return option.isSet
}

// IsSetDefault returns true if option has been set via the default option tag
func (option *Option) IsSetDefault() bool {
	return option.isSetDefault
}

// Set the value of an option to the specified value. An error will be returned
// if the specified value could not be converted to the corresponding option
// value type.
func (option *Option) Set(value *string) error {
	kind := option.value.Type().Kind()

	if (kind == reflect.Map || kind == reflect.Slice) && option.clearReferenceBeforeSet {
		option.empty()
	}

	option.isSet = true
	option.preventDefault = true
	option.clearReferenceBeforeSet = false

	if len(option.Choices) != 0 {
		found := false

		for _, choice := range option.Choices {
			if choice == *value {
				found = true
				break
			}
		}

		if !found {
			allowed := strings.Join(option.Choices[0:len(option.Choices)-1], ", ")

			if len(option.Choices) > 1 {
				allowed += " or " + option.Choices[len(option.Choices)-1]
			}

			return newErrorf(ErrInvalidChoice,
				"Invalid value `%s' for option `%s'. Allowed values are: %s",
				*value, option, allowed)
		}
	}

	if option.isFunc() {
		return option.call(value)
	} else if value != nil {
		return convert(*value, option.value, option.tag)
	}

	return convert("", option.value, option.tag)
}

func (option *Option) setDefault(value *string) error {
	if option.preventDefault {
		return nil
	}

	if err := option.Set(value); err != nil {
		return err
	}

	option.isSetDefault = true
	option.preventDefault = false

	return nil
}

func (option *Option) showInHelp() bool {
	return !option.Hidden && (option.ShortName != 0 || len(option.LongName) != 0)
}

func (option *Option) canArgument() bool {
	if u := option.isUnmarshaler(); u != nil {
		return true
	}

	return !option.isBool()
}

func (option *Option) emptyValue() reflect.Value {
	tp := option.value.Type()

	if tp.Kind() == reflect.Map {
		return reflect.MakeMap(tp)
	}

	return reflect.Zero(tp)
}

func (option *Option) empty() {
	if !option.isFunc() {
		option.value.Set(option.emptyValue())
	}
}

func (option *Option) clearDefault() error {
	if option.preventDefault {
		return nil
	}

	usedDefault := option.Default

	if envKey := option.EnvKeyWithNamespace(); envKey != "" {
		if value, ok := os.LookupEnv(envKey); ok {
			if option.EnvDefaultDelim != "" {
				usedDefault = strings.Split(value, option.EnvDefaultDelim)
			} else {
				usedDefault = []string{value}
			}
		}
	}

	option.isSetDefault = true

	if len(usedDefault) > 0 {
		option.empty()

		for _, d := range usedDefault {
			err := option.setDefault(&d)

			if err != nil {
				return err
			}
		}
	} else {
		tp := option.value.Type()

		switch tp.Kind() {
		case reflect.Map:
			if option.value.IsNil() {
				option.empty()
			}
		case reflect.Slice:
			if option.value.IsNil() {
				option.empty()
			}
		}
	}

	return nil
}

func (option *Option) valueIsDefault() bool {
	// Check if the value of the option corresponds to its
	// default value
	emptyval := option.emptyValue()

	checkvalptr := reflect.New(emptyval.Type())
	checkval := reflect.Indirect(checkvalptr)

	checkval.Set(emptyval)

	if len(option.Default) != 0 {
		for _, v := range option.Default {
			convert(v, checkval, option.tag)
		}
	}

	return reflect.DeepEqual(option.value.Interface(), checkval.Interface())
}

func (option *Option) isUnmarshaler() Unmarshaler {
	v := option.value

	for {
		if !v.CanInterface() {
			break
		}

		i := v.Interface()

		if u, ok := i.(Unmarshaler); ok {
			return u
		}

		if !v.CanAddr() {
			break
		}

		v = v.Addr()
	}

	return nil
}

func (option *Option) isValueValidator() ValueValidator {
	v := option.value

	for {
		if !v.CanInterface() {
			break
		}

		i := v.Interface()

		if u, ok := i.(ValueValidator); ok {
			return u
		}

		if !v.CanAddr() {
			break
		}

		v = v.Addr()
	}

	return nil
}

func (option *Option) isBool() bool {
	tp := option.value.Type()

	for {
		switch tp.Kind() {
		case reflect.Slice, reflect.Ptr:
			tp = tp.Elem()
		case reflect.Bool:
			return true
		case reflect.Func:
			return tp.NumIn() == 0
		default:
			return false
		}
	}
}

func (option *Option) isSignedNumber() bool {
	tp := option.value.Type()

	for {
		switch tp.Kind() {
		case reflect.Slice, reflect.Ptr:
			tp = tp.Elem()
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Float32, reflect.Float64:
			return true
		default:
			return false
		}
	}
}

func (option *Option) isFunc() bool {
	return option.value.Type().Kind() == reflect.Func
}

func (option *Option) call(value *string) error {
	var retval []reflect.Value

	if value == nil {
		retval = option.value.Call(nil)
	} else {
		tp := option.value.Type().In(0)

		val := reflect.New(tp)
		val = reflect.Indirect(val)

		if err := convert(*value, val, option.tag); err != nil {
			return err
		}

		retval = option.value.Call([]reflect.Value{val})
	}

	if len(retval) == 1 && retval[0].Type() == reflect.TypeOf((*error)(nil)).Elem() {
		if retval[0].Interface() == nil {
			return nil
		}

		return retval[0].Interface().(error)
	}

	return nil
}

func (option *Option) updateDefaultLiteral() {
	defs := option.Default
	def := ""

	if len(defs) == 0 && option.canArgument() {
		var showdef bool

		switch option.field.Type.Kind() {
		case reflect.Func, reflect.Ptr:
			showdef = !option.value.IsNil()
		case reflect.Slice, reflect.String, reflect.Array:
			showdef = option.value.Len() > 0
		case reflect.Map:
			showdef = !option.value.IsNil() && option.value.Len() > 0
		default:
			zeroval := reflect.Zero(option.field.Type)
			showdef = !reflect.DeepEqual(zeroval.Interface(), option.value.Interface())
		}

		if showdef {
			def, _ = convertToString(option.value, option.tag)
		}
	} else if len(defs) != 0 {
		l := len(defs) - 1

		for i := 0; i < l; i++ {
			def += quoteIfNeeded(defs[i]) + ", "
		}

		def += quoteIfNeeded(defs[l])
	}

	option.defaultLiteral = def
}

func (option *Option) shortAndLongName() string {
	ret := &bytes.Buffer{}

	if option.ShortName != 0 {
		ret.WriteRune(defaultShortOptDelimiter)
		ret.WriteRune(option.ShortName)
	}

	if len(option.LongName) != 0 {
		if option.ShortName != 0 {
			ret.WriteRune('/')
		}

		ret.WriteString(option.LongName)
	}

	return ret.String()
}

func (option *Option) isValidValue(arg string) error {
	if validator := option.isValueValidator(); validator != nil {
		return validator.IsValidValue(arg)
	}
	if argumentIsOption(arg) && !(option.isSignedNumber() && len(arg) > 1 && arg[0] == '-' && arg[1] >= '0' && arg[1] <= '9') {
		return fmt.Errorf("expected argument for flag `%s', but got option `%s'", option, arg)
	}
	return nil
}
