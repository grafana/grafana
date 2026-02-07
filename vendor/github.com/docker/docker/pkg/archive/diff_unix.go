//go:build !windows

package archive

import "golang.org/x/sys/unix"

// overrideUmask sets current process's file mode creation mask to newmask
// and returns a function to restore it.
//
// WARNING for readers stumbling upon this code. Changing umask in a multi-
// threaded environment isn't safe. Don't use this without understanding the
// risks, and don't export this function for others to use (we shouldn't even
// be using this ourself).
//
// FIXME(thaJeztah): we should get rid of these hacks if possible.
func overrideUmask(newMask int) func() {
	oldMask := unix.Umask(newMask)
	return func() {
		unix.Umask(oldMask)
	}
}
