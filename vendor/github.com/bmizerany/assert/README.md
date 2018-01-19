# NO LONGER MAINTAINED - Just use Go's testing package.

# Assert (c) Blake Mizerany and Keith Rarick -- MIT LICENCE

## Assertions for Go tests

## Install

    $ go get github.com/bmizerany/assert

## Use

**point.go**

    package point

    type Point struct {
        x, y int
    }

**point_test.go**


    package point

    import (
        "testing"
        "github.com/bmizerany/assert"
    )

    func TestAsserts(t *testing.T) {
        p1 := Point{1, 1}
        p2 := Point{2, 1}

        assert.Equal(t, p1, p2)
    }

**output**
    $ go test
     --- FAIL: TestAsserts (0.00 seconds)
	 assert.go:15: /Users/flavio.barbosa/dev/stewie/src/point_test.go:12
         assert.go:24: ! X: 1 != 2
	 FAIL

## Docs

    http://github.com/bmizerany/assert
