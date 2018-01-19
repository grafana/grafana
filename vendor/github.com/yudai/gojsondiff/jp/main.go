package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/codegangsta/cli"

	diff "github.com/yudai/gojsondiff"
)

func main() {
	app := cli.NewApp()
	app.Name = "jd"
	app.Usage = "JSON Diff"
	app.Version = "0.0.2"

	app.Flags = []cli.Flag{}

	app.Action = func(c *cli.Context) {
		if len(c.Args()) < 2 {
			fmt.Println("Not enough arguments.\n")
			fmt.Printf("Usage: %s diff json_file\n", app.Name)
			os.Exit(1)
		}

		diffFilePath := c.Args()[0]
		jsonFilePath := c.Args()[1]

		// Diff file
		diffFile, err := ioutil.ReadFile(diffFilePath)
		if err != nil {
			fmt.Printf("Failed to open file '%s': %s\n", diffFilePath, err.Error())
			os.Exit(2)
		}

		// Load Diff file
		um := diff.NewUnmarshaller()
		diffObject, err := um.UnmarshalBytes(diffFile)
		if err != nil {
			fmt.Printf("Failed to load diff file '%s': %s\n", diffFilePath, err.Error())
			os.Exit(2)
		}

		// JSON file
		jsonFile, err := ioutil.ReadFile(jsonFilePath)
		if err != nil {
			fmt.Printf("Failed to open file '%s': %s\n", jsonFilePath, err.Error())
			os.Exit(2)
		}

		// Load JSON
		var jsonObject map[string]interface{}
		json.Unmarshal(jsonFile, &jsonObject)

		// Apply
		differ := diff.New()
		differ.ApplyPatch(jsonObject, diffObject)

		pachedJson, _ := json.MarshalIndent(jsonObject, "", "  ")
		fmt.Println(string(pachedJson))
	}

	app.Run(os.Args)
}
