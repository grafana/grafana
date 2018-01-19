## About

This is a memcache client library for the Go programming language
(http://golang.org/).

## Installing

### Using *go get*

    $ go get github.com/bradfitz/gomemcache/memcache

After this command *gomemcache* is ready to use. Its source will be in:

    $GOPATH/src/github.com/bradfitz/gomemcache/memcache

## Example

    import (
            "github.com/bradfitz/gomemcache/memcache"
    )

    func main() {
         mc := memcache.New("10.0.0.1:11211", "10.0.0.2:11211", "10.0.0.3:11212")
         mc.Set(&memcache.Item{Key: "foo", Value: []byte("my value")})

         it, err := mc.Get("foo")
         ...
    }

## Full docs, see:

See https://godoc.org/github.com/bradfitz/gomemcache/memcache

Or run:

    $ godoc github.com/bradfitz/gomemcache/memcache

