package cli

type GenericFlag = FlagBase[Value, NoConfig, genericValue]

// -- Value Value
type genericValue struct {
	val Value
}

// Below functions are to satisfy the ValueCreator interface

func (f genericValue) Create(val Value, p *Value, c NoConfig) Value {
	*p = val
	return &genericValue{
		val: *p,
	}
}

func (f genericValue) ToString(b Value) string {
	if b != nil {
		return b.String()
	}
	return ""
}

// Below functions are to satisfy the flag.Value interface

func (f *genericValue) Set(s string) error {
	if f.val != nil {
		return f.val.Set(s)
	}
	return nil
}

func (f *genericValue) Get() any {
	if f.val != nil {
		return f.val.Get()
	}
	return nil
}

func (f *genericValue) String() string {
	if f.val != nil {
		return f.val.String()
	}
	return ""
}

func (f *genericValue) IsBoolFlag() bool {
	if f.val == nil {
		return false
	}
	bf, ok := f.val.(boolFlag)
	return ok && bf.IsBoolFlag()
}

// Generic looks up the value of a local GenericFlag, returns
// nil if not found
func (cmd *Command) Generic(name string) Value {
	if v, ok := cmd.Value(name).(Value); ok {
		tracef("generic available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)
		return v
	}

	tracef("generic NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return nil
}
