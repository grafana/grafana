package archive

// overrideUmask is a no-op on windows.
func overrideUmask(newmask int) func() {
	return func() {}
}
