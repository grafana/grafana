uarand
----------------

[![Build Status](https://travis-ci.org/corpix/uarand.svg?branch=master)](https://travis-ci.org/corpix/uarand)

Random user-agent producer for go.

## Example

``` go
package main

import (
	"fmt"

	"github.com/corpix/uarand"
)

func main() {
	fmt.Println(uarand.GetRandom())
}
```

Save it to `snippet.go` and run:

``` shell
go run snippet.go
```

Which should produce something similar to:

``` text
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36
```

## License

MIT
