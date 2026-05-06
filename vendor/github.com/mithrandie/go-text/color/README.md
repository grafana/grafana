# color

This package provides support for coloring text with ANSI escape sequences.

## Examples

```go
package main

import (
	"encoding/json"
	"fmt"
	
	"github.com/mithrandie/go-text/color"
)

const (
	BlueColor   = "blue"
	YellowColor = "yellow"
)

type Config struct {
	Palette              color.PaletteConfig `json:"palette"`
}

var jsonConfig = `
{
  "palette": {
    "effectors": {
      "color1": {
        "effects": [
          "Bold"
        ],
        "foreground": "Blue",
        "background": null
      },
      "color2": {
        "effects": [],
        "foreground": "Magenta",
        "background": null
      }
    }
  }
}
`

func main() {
	message := "message"
	
	// Use JSON Configuration 
	conf := &Config{} 
	if err := json.Unmarshal([]byte(jsonConfig), conf); err != nil {
		panic(err)
	}
	
	palette, err := color.GeneratePalette(conf.Palette)
	if err != nil {
		panic(err)
	}
	
	fmt.Println(palette.Render("color1", message))

	// Use Effector
	e := color.NewEffector()
	e.SetFGColor(color.Red)
	e.SetEffect(color.Bold, color.Italic)
	
	fmt.Println(e.Render(message))
	
	// Use Palette that bundles multiple effectors.
	blue := color.NewEffector()
	blue.SetFGColor(color.Blue)
	yellow := color.NewEffector()
	yellow.SetFGColor(color.Blue)
	
	palette.SetEffector(BlueColor, blue)
	palette.SetEffector(YellowColor, yellow)
	
	fmt.Println(palette.Render(BlueColor, message))
}
```
