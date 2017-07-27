package conf

import (
	"fmt"
	"runtime"
	"syscall"

	"github.com/qiniu/x/ctype.v7"
	"github.com/qiniu/x/rpc.v7"
)

var version = "7.1.0"

var ACCESS_KEY string
var SECRET_KEY string

// ----------------------------------------------------------

const (
	ctypeAppName = ctype.ALPHA | ctype.DIGIT | ctype.UNDERLINE | ctype.SPACE_BAR | ctype.SUB | ctype.DOT
)

// userApp should be [A-Za-z0-9_\ \-\.]*
//
func SetAppName(userApp string) error {
	if userApp != "" && !ctype.IsType(ctypeAppName, userApp) {
		return syscall.EINVAL
	}
	rpc.UserAgent = fmt.Sprintf(
		"QiniuGo/%s (%s; %s; %s) %s", version, runtime.GOOS, runtime.GOARCH, userApp, runtime.Version())
	return nil
}

func init() {
	SetAppName("")
}

// ----------------------------------------------------------
