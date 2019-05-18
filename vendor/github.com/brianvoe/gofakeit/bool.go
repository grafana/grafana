package gofakeit

// Bool will generate a random boolean value
func Bool() bool {
	if randIntRange(0, 1) == 1 {
		return true
	}

	return false
}
