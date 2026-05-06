package goff_error

type InvalidOption struct {
	Message string
}

func (i InvalidOption) Error() string {
	return i.Message
}

func NewInvalidOption(message string) InvalidOption {
	return InvalidOption{Message: message}
}
