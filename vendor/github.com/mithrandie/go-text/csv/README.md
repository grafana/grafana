# csv

This package provides support for reading and writing CSV format.

## Examples

```go
package main

import (
	"os"
	
	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/csv"
)

func main() {
	fp, err := os.Open("example.csv")
	if err != nil {
		panic("file open error")
	}
	defer func() {
		if err = fp.Close(); err != nil {
			panic(err.Error())
		}
	}()
	
	r, _ := csv.NewReader(fp, text.UTF8)
	r.Delimiter = ','
	r.WithoutNull = true
	recordSet, err := r.ReadAll()
	if err != nil {
		panic("csv read error")
	}
	
	lineBreak := r.DetectedLineBreak
	
	wfp, err := os.Create("example_new.csv")
	if err != nil {
		panic("file open error")
	}
	defer func() {
		if err = wfp.Close(); err != nil {
			panic(err.Error())
		}
	}()
	
	w, err := csv.NewWriter(wfp, lineBreak, text.SJIS)
	if err != nil {
		panic(err.Error())
	}
	w.Delimiter = ','
	
	for _, record := range recordSet {
		r := make([]csv.Field, 0, len(record))
		for _, field := range record {
			r = append(r, csv.NewField(string(field), false))
		}
		if err := w.Write(r); err != nil {
			panic("write error")
		}
	}
	if err = w.Flush(); err != nil {
		panic(err)
	}
}
```
