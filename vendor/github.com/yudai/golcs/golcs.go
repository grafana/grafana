package lcs

import (
	"reflect"
)

type Lcs interface {
	Values() (values []interface{})
	IndexPairs() (pairs []IndexPair)
	Length() (length int)
	Left() (leftValues []interface{})
	Right() (righttValues []interface{})
}

type IndexPair struct {
	Left  int
	Right int
}

type lcs struct {
	left  []interface{}
	right []interface{}
	/* for caching */
	table      [][]int
	indexPairs []IndexPair
	values     []interface{}
}

func New(left, right []interface{}) Lcs {
	return &lcs{
		left:       left,
		right:      right,
		table:      nil,
		indexPairs: nil,
		values:     nil,
	}
}

func (lcs *lcs) Table() (table [][]int) {
	if lcs.table != nil {
		return lcs.table
	}

	sizeX := len(lcs.left) + 1
	sizeY := len(lcs.right) + 1

	table = make([][]int, sizeX)
	for x := 0; x < sizeX; x++ {
		table[x] = make([]int, sizeY)
	}

	for y := 1; y < sizeY; y++ {
		for x := 1; x < sizeX; x++ {
			increment := 0
			if reflect.DeepEqual(lcs.left[x-1], lcs.right[y-1]) {
				increment = 1
			}
			table[x][y] = max(table[x-1][y-1]+increment, table[x-1][y], table[x][y-1])
		}
	}

	lcs.table = table
	return
}

func (lcs *lcs) Length() (length int) {
	length = lcs.Table()[len(lcs.left)][len(lcs.right)]
	return
}

func (lcs *lcs) IndexPairs() (pairs []IndexPair) {
	if lcs.indexPairs != nil {
		return lcs.indexPairs
	}

	table := lcs.Table()
	pairs = make([]IndexPair, table[len(table)-1][len(table[0])-1])

	for x, y := len(lcs.left), len(lcs.right); x > 0 && y > 0; {
		if reflect.DeepEqual(lcs.left[x-1], lcs.right[y-1]) {
			pairs[table[x][y]-1] = IndexPair{Left: x - 1, Right: y - 1}
			x--
			y--
		} else {
			if table[x-1][y] >= table[x][y-1] {
				x--
			} else {
				y--
			}
		}
	}

	lcs.indexPairs = pairs

	return
}

func (lcs *lcs) Values() (values []interface{}) {
	if lcs.values != nil {
		return lcs.values
	}

	pairs := lcs.IndexPairs()
	values = make([]interface{}, len(pairs))
	for i, pair := range pairs {
		values[i] = lcs.left[pair.Left]
	}
	lcs.values = values
	return
}

func (lcs *lcs) Left() (leftValues []interface{}) {
	leftValues = lcs.left
	return
}

func (lcs *lcs) Right() (rightValues []interface{}) {
	rightValues = lcs.right
	return
}

func max(first int, rest ...int) (max int) {
	max = first
	for _, value := range rest {
		if value > max {
			max = value
		}
	}
	return
}
