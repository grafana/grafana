package cli

type (
	StringMap     = MapBase[string, StringConfig, stringValue]
	StringMapFlag = FlagBase[map[string]string, StringConfig, StringMap]
)

var NewStringMap = NewMapBase[string, StringConfig, stringValue]

// StringMap looks up the value of a local StringMapFlag, returns
// nil if not found
func (cmd *Command) StringMap(name string) map[string]string {
	if v, ok := cmd.Value(name).(map[string]string); ok {
		tracef("string map available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)
		return v
	}

	tracef("string map NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return nil
}
