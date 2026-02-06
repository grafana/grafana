package cli

type (
	StringSlice     = SliceBase[string, StringConfig, stringValue]
	StringSliceFlag = FlagBase[[]string, StringConfig, StringSlice]
)

var NewStringSlice = NewSliceBase[string, StringConfig, stringValue]

// StringSlice looks up the value of a local StringSliceFlag, returns
// nil if not found
func (cmd *Command) StringSlice(name string) []string {
	if v, ok := cmd.Value(name).([]string); ok {
		tracef("string slice available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)
		return v
	}

	tracef("string slice NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return nil
}
