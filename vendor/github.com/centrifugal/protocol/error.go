package protocol

import (
	"fmt"
)

func (e Error) Error() string {
	return fmt.Sprintf("%d: %s", e.Code, e.Message)
}
