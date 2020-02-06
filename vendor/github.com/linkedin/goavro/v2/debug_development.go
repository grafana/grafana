// +build goavro_debug

package goavro

import (
	"fmt"
	"os"
)

// debug formats and prints arguments to stderr for development builds
func debug(f string, a ...interface{}) {
	os.Stderr.Write([]byte("goavro: " + fmt.Sprintf(f, a...)))
}
