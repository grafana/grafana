// +build darwin freebsd netbsd openbsd

package runner

// ForceKill is a Chrome command line option that forces Chrome to be killed
// when the parent is killed.
//
// Note: sets exec.Cmd.SysProcAttr.Setpgid = true (only for Linux)
func ForceKill(m map[string]interface{}) error {
	return nil
}
