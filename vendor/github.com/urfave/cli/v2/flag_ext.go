package cli

import "flag"

type extFlag struct {
	f *flag.Flag
}

func (e *extFlag) Apply(fs *flag.FlagSet) error {
	fs.Var(e.f.Value, e.f.Name, e.f.Usage)
	return nil
}

func (e *extFlag) Names() []string {
	return []string{e.f.Name}
}

func (e *extFlag) IsSet() bool {
	return false
}

func (e *extFlag) String() string {
	return FlagStringer(e)
}

func (e *extFlag) IsVisible() bool {
	return true
}

func (e *extFlag) TakesValue() bool {
	return false
}

func (e *extFlag) GetUsage() string {
	return e.f.Usage
}

func (e *extFlag) GetValue() string {
	return e.f.Value.String()
}

func (e *extFlag) GetDefaultText() string {
	return e.f.DefValue
}

func (e *extFlag) GetEnvVars() []string {
	return nil
}
