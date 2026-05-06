package cli

type numberType interface {
	int | int8 | int16 | int32 | int64 | float32 | float64
}

func getNumberSlice[T numberType](cmd *Command, name string) []T {
	if v, ok := cmd.Value(name).([]T); ok {
		tracef("%T slice available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", *new(T), name, v, cmd.Name)
		return v
	}

	tracef("%T slice NOT available for flag name %[1]q (cmd=%[2]q)", *new(T), name, cmd.Name)
	return nil
}
