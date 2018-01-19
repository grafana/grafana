// +build js

package big

// TODO: This is a workaround for https://github.com/gopherjs/gopherjs/issues/652.
//       Remove after that issue is resolved.
type Word uintptr
