package dst

// CloneObject returns nil: After cloning a node, it should not be attached to the same object / scope.
func CloneObject(o *Object) *Object {
	return nil
}

// CloneScope returns nil: After cloning a node, it should not be attached to the same object / scope.
func CloneScope(s *Scope) *Scope {
	return nil
}
