package cli

import "flag"

type extFlag struct {
	f *flag.Flag
}

func (e *extFlag) PreParse() error {
	if e.f.DefValue != "" {
		return e.Set("", e.f.DefValue)
	}

	return nil
}

func (e *extFlag) PostParse() error {
	return nil
}

func (e *extFlag) Set(_ string, val string) error {
	return e.f.Value.Set(val)
}

func (e *extFlag) Get() any {
	return e.f.Value.(flag.Getter).Get()
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
