# json

This package provides support for encoding and decoding JSON format.

## Examples

```go
package main

import (
	"fmt"
	"io/ioutil"
	
	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/json"
)

func main() {
	data, err := ioutil.ReadFile("example.json")
	if err != nil {
		panic("file open error")
	}
	
	d := json.NewDecoder()
	structure, escapeType, err := d.Decode(string(data))
	if err != nil {
		panic("json decode error")
	}
	
	e := json.NewEncoder()
	e.EscapeType = escapeType
	e.LineBreak = text.LF
	e.PrettyPrint = true
	e.Palette = json.NewJsonPalette()
	
	encoded := e.Encode(structure)
	fmt.Println(encoded)
}
```
