package core

import (
	"fmt"
	"sort"
	"strings"
)

const (
	IndexType = iota + 1
	UniqueType
)

// database index
type Index struct {
	IsRegular bool
	Name      string
	Type      int
	Cols      []string
}

func (index *Index) XName(tableName string) string {
	if !strings.HasPrefix(index.Name, "UQE_") &&
		!strings.HasPrefix(index.Name, "IDX_") {
		if index.Type == UniqueType {
			return fmt.Sprintf("UQE_%v_%v", tableName, index.Name)
		}
		return fmt.Sprintf("IDX_%v_%v", tableName, index.Name)
	}
	return index.Name
}

// add columns which will be composite index
func (index *Index) AddColumn(cols ...string) {
	for _, col := range cols {
		index.Cols = append(index.Cols, col)
	}
}

func (index *Index) Equal(dst *Index) bool {
	if index.Type != dst.Type {
		return false
	}
	if len(index.Cols) != len(dst.Cols) {
		return false
	}
	sort.StringSlice(index.Cols).Sort()
	sort.StringSlice(dst.Cols).Sort()

	for i := 0; i < len(index.Cols); i++ {
		if index.Cols[i] != dst.Cols[i] {
			return false
		}
	}
	return true
}

// new an index
func NewIndex(name string, indexType int) *Index {
	return &Index{true, name, indexType, make([]string, 0)}
}
