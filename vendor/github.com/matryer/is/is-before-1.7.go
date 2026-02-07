// +build !go1.7

package is

import (
	"regexp"
	"runtime"
)

var reIsSourceFile = regexp.MustCompile("is(-before-1.7)?\\.go$")

func (is *I) callerinfo() (path string, line int, ok bool) {
	for i := 0; ; i++ {
		_, path, line, ok = runtime.Caller(i)
		if !ok {
			return
		}
		if reIsSourceFile.MatchString(path) {
			continue
		}
		return path, line, true
	}
}
