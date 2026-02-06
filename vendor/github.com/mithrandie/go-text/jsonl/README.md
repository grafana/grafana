# jsonl

This package provides support for reading JSON Lines format.

## Examples

```go
package main

import (
	"fmt"
	"os"

	"github.com/mithrandie/go-text/json"
	"github.com/mithrandie/go-text/jsonl"
)

func main() {
	fp, err := os.Open("example.jsonl")
	if err != nil {
		panic("file open error")
	}
	defer func() {
		if err = fp.Close(); err != nil {
			panic(err.Error())
		}
	}()

	r := jsonl.NewReader(fp)
	structures, escapeType, err := r.ReadAll()

	fmt.Printf("Escape Type: %v\n", escapeType)

	e := json.NewEncoder()
	e.EscapeType = escapeType

	for _, st := range structures {
		fmt.Println(e.Encode(st))
    }
}
```