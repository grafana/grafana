# table

This package provides support for writing text tables.

## Examples

```go
package main

import (
	"fmt"
	
	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/table"
)

func main() {
	header := []table.Field{
		table.NewField("c1", text.Centering),
		table.NewField("c2", text.Centering),
		table.NewField("c3", text.Centering),
	}
	
	recordSet := [][]table.Field{
		{
			table.NewField("1", text.RightAligned),
			table.NewField("abc", text.LeftAligned),
			table.NewField("true", text.NotAligned),
		},
		{
			table.NewField("2", text.RightAligned),
			table.NewField("def", text.LeftAligned),
			table.NewField("true", text.NotAligned),
		},
		{
			table.NewField("3", text.RightAligned),
			table.NewField("ghi", text.LeftAligned),
			table.NewField("true", text.NotAligned),
		},
	}
	
	alignments := []text.FieldAlignment{
		text.RightAligned,
		text.LeftAligned,
		text.NotAligned,
	}
	
	e := table.NewEncoder(table.GFMTable, len(recordSet))
	e.LineBreak = text.LF
	e.EastAsianEncoding = true
	e.CountDiacriticalSign = false
	e.WithoutHeader = false
    
	
	e.SetHeader(header)
	for _, record := range recordSet {
		e.AppendRecord(record)
	}
	e.SetFieldAlignments(alignments)
	
	encoded, _ := e.Encode()
	fmt.Println(encoded)
}
```
