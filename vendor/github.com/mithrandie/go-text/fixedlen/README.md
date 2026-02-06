# fixedlen

This package provides support for reading and writing Fixed-Length format.

## Examples

```go
package main

import (
	"os"
	
	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/fixedlen"
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
	
	r, _ := fixedlen.NewReader(fp, []int{5, 10, 45, 60}, text.UTF8)
	r.WithoutNull = true
	recordSet, err := r.ReadAll()
	if err != nil {
		panic("fixed-length read error")
	}
	
	lineBreak := r.DetectedLineBreak
	
	wfp, err := os.Create("example_new.txt")
	if err != nil {
		panic("file open error")
	}
	defer func() {
		if err = wfp.Close(); err != nil {
			panic(err.Error())
		}
	}()

	w, err := fixedlen.NewWriter(wfp, []int{5, 10, 45, 60}, lineBreak, text.SJIS)
	if err != nil {
		panic(err.Error)
	}
	
	for _, record := range recordSet {
		r := make([]fixedlen.Field, 0, len(record))
		for _, field := range record {
			r = append(r, fixedlen.NewField(string(field), text.NotAligned))
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
