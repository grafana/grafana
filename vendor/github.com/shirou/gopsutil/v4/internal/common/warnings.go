// SPDX-License-Identifier: BSD-3-Clause
package common

import "fmt"

type Warnings struct {
	List    []error
	Verbose bool
}

func (w *Warnings) Add(err error) {
	w.List = append(w.List, err)
}

func (w *Warnings) Reference() error {
	if len(w.List) > 0 {
		return w
	}
	return nil
}

func (w *Warnings) Error() string {
	if w.Verbose {
		str := ""
		for i, e := range w.List {
			str += fmt.Sprintf("\tError %d: %s\n", i, e.Error())
		}
		return str
	}
	return fmt.Sprintf("Number of warnings: %v", len(w.List))
}
