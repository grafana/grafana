# Go JsonLogic

![test workflow](https://github.com/diegoholiveira/jsonlogic/actions/workflows/test.yml/badge.svg)
[![codecov](https://codecov.io/gh/diegoholiveira/jsonlogic/branch/master/graph/badge.svg)](https://codecov.io/gh/diegoholiveira/jsonlogic)
[![Go Report Card](https://goreportcard.com/badge/github.com/diegoholiveira/jsonlogic)](https://goreportcard.com/report/github.com/diegoholiveira/jsonlogic)

Implementation of [JsonLogic](http://jsonlogic.com) in Go Lang.

## What's JsonLogic?

JsonLogic is a DSL to write logic decisions in JSON. It's has a great specification and is very simple to learn.
The [official website](http://jsonlogic.com) has great documentation with examples.

## How to use it

The use of this library is very straightforward. Here's a simple example:

```go
package main

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/diegoholiveira/jsonlogic/v3"
)

func main() {
	logic := strings.NewReader(`{"==": [1, 1]}`)
	data := strings.NewReader(`{}`)

	var result bytes.Buffer

	jsonlogic.Apply(logic, data, &result)

	fmt.Println(result.String())
}
```

This will output `true` in your console.

Here's another example, but this time using variables passed in the `data` parameter:

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/diegoholiveira/jsonlogic/v3"
)

type (
	User struct {
		Name     string `json:"name"`
		Age      int    `json:"age"`
		Location string `json:"location"`
	}

	Users []User
)

func main() {
	logic := strings.NewReader(`{
        "filter": [
            {"var": "users"},
            {">=": [
                {"var": ".age"},
                18
            ]}
        ]
    }`)

	data := strings.NewReader(`{
        "users": [
            {"name": "Diego", "age": 33, "location": "Florianópolis"},
            {"name": "Jack", "age": 12, "location": "London"},
            {"name": "Pedro", "age": 19, "location": "Lisbon"},
            {"name": "Leopoldina", "age": 30, "location": "Rio de Janeiro"}
        ]
    }`)

	var result bytes.Buffer

	err := jsonlogic.Apply(logic, data, &result)
	if err != nil {
		fmt.Println(err.Error())

		return
	}

	var users Users

	decoder := json.NewDecoder(&result)
	decoder.Decode(&users)

	for _, user := range users {
		fmt.Printf("    - %s\n", user.Name)
	}
}
```

If you have a function you want to expose as a JsonLogic operation, you can use:

```go
package main

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/diegoholiveira/jsonlogic/v3"
)

func main() {
	// add a new operator "strlen" for get string length
	jsonlogic.AddOperator("strlen", func(values, data any) any {
		v, ok := values.(string)
		if ok {
			return len(v)
		}
		return 0
	})

	logic := strings.NewReader(`{ "strlen": { "var": "foo" } }`)
	data := strings.NewReader(`{"foo": "bar"}`)

	var result bytes.Buffer

	jsonlogic.Apply(logic, data, &result)

	fmt.Println(result.String()) // the string length of "bar" is 3
}
```

If you want to get the JsonLogic used, with the variables replaced by their values:

```go
package main

import (
	"fmt"
	"encoding/json"

	"github.com/diegoholiveira/jsonlogic/v3"
)

func main() {
	logic := json.RawMessage(`{ "==":[{ "var":"foo" }, true] }`)
	data := json.RawMessage(`{"foo": "false"}`)

	result, err := jsonlogic.GetJsonLogicWithSolvedVars(logic, data)

	if err != nil {
		fmt.Println(err)
	}

	fmt.Println(string(result)) // will output { "==":[false, true] }
}
```

# License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.
