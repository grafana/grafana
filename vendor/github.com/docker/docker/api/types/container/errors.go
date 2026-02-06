package container

type errInvalidParameter struct{ error }

func (e *errInvalidParameter) InvalidParameter() {}

func (e *errInvalidParameter) Unwrap() error {
	return e.error
}
