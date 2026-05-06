# go-jsonmerge
[![Build Status](https://travis-ci.org/RaveNoX/go-jsonmerge.svg?branch=master)](https://travis-ci.org/RaveNoX/go-jsonmerge)
[![GoDoc](https://godoc.org/github.com/RaveNoX/go-jsonmerge?status.svg)](https://godoc.org/github.com/RaveNoX/go-jsonmerge)

GO library for merging JSON objects

## Original document
```json
{  
  "number": 1,
  "string": "value",
  "object": {
    "number": 1,
    "string": "value",
    "nested object": {
      "number": 2
    },
    "array": [1, 2, 3],
    "partial_array": [1, 2, 3]
  }
}
```

## Patch
```json
{  
  "number": 2,
  "string": "value1",
  "nonexitent": "woot",
  "object": {
    "number": 3,
    "string": "value2",
    "nested object": {
      "number": 4
    },
    "array": [3, 2, 1],
    "partial_array": {
      "1": 4
    }
  }
}
```

## Result
```json
{  
  "number": 2,
  "string": "value1",
  "object": {
    "number": 3,
    "string": "value2",
    "nested object": {
      "number": 4
    },
    "array": [3, 2, 1],
    "partial_array": [1, 4, 3]
  }
}
```

## Commandline Tool

```bash
$ go get -u github.com/RaveNoX/go-jsonmerge/cmd/jsonmerge
$ jsonmerge [options] <patch.json> <glob1.json> <glob2.json>...<globN.json>
# For help
$ jsonmerge -h
```

## Development
```
# Install depencencies
./init.sh

# Build
./build.sh
```


## License
[MIT](./LICENSE.MD)
