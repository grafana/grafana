package gapi

import "fmt"

type ErrNotFound struct {
	BodyContents []byte
}

func (e ErrNotFound) Error() string {
	return fmt.Sprintf("status: 404, body: %s", e.BodyContents)
}
