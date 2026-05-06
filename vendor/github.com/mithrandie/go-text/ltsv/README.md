# ltsv

This package provides support for reading and writing LTSV format.

## Examples

```go
package main

import (
	"os"
	
	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/ltsv"
)

func main() {
	fp, err := os.Open("example.txt")
	if err != nil {
		panic("file open error")
	}
	defer func() {
		if err = fp.Close(); err != nil {
			panic(err.Error())
		}
	}()
	
	r, _ := ltsv.NewReader(fp, text.UTF8)
	r.WithoutNull = true
	recordSet, err := r.ReadAll()
	if err != nil {
		panic("ltsv read error")
	}
	
	header := r.Header.Fields()
	lineBreak := r.DetectedLineBreak
	
	wfp, err := os.Create("example_new.ltsv")
	if err != nil {
		panic("file open error")
	}
	defer func() {
		if err = wfp.Close(); err != nil {
			panic(err.Error())
		}
	}()

	w, err := ltsv.NewWriter(wfp, header, lineBreak, text.UTF8)
	if err != nil {
		panic("ltsv writer generation error")
	}
	
	for _, record := range recordSet {
		r := make([]string, 0, len(record))
		for _, field := range record {
			r = append(r, string(field))
		}
		if err = w.Write(r); err != nil {
			panic(err.Error())
		}
	}
	if err = w.Flush(); err != nil {
		panic(err.Error())
	}
}
```
