package browser

import (
	"errors"
	"os/exec"
)

func openBrowser(url string) error {
	err := runCmd("xdg-open", url)
	if e, ok := err.(*exec.Error); ok && e.Err == exec.ErrNotFound {
		return errors.New("xdg-open: command not found - install xdg-utils from pkgsrc(7)")
	}
	return err
}
