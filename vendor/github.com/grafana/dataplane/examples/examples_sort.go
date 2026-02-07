package examples

import (
	"sort"
	"strings"
)

func (e *Examples) Sort(sorters ...ExampleSortFunc) {
	sort.Slice(e.e, func(i int, j int) bool {
		for _, s := range sorters {
			equal, less := s((e.e)[i], (e.e)[j])
			if equal {
				continue
			}
			return less
		}
		return false
	})
}

type ExampleSortFunc func(i, j Example) (equal, less bool)

func SortKindAsc(i, j Example) (equal, less bool) {
	a, b := string(i.info.Type.Kind()), string(j.info.Type.Kind())
	if a != b {
		return false, a < b
	}
	return true, false
}

func SortKindDesc(i, j Example) (equal, less bool) {
	a, b := string(i.info.Type.Kind()), string(j.info.Type.Kind())
	if a != b {
		return false, a > b
	}
	return true, false
}

func SortFrameTypeAsc(i, j Example) (equal, less bool) {
	a, b := string(i.info.Type), string(j.info.Type)
	if a != b {
		return false, a < b
	}
	return true, false
}

func SortFrameTypeDesc(i, j Example) (equal, less bool) {
	a, b := string(i.info.Type), string(j.info.Type)
	if a != b {
		return false, a > b
	}
	return true, false
}

func SortCollectionAsc(i, j Example) (equal, less bool) {
	a, b := i.info.CollectionName, j.info.CollectionName
	if a != b {
		return false, a < b
	}
	return true, false
}

func SortCollectionDesc(i, j Example) (equal, less bool) {
	a, b := i.info.CollectionName, j.info.CollectionName
	if a != b {
		return false, a > b
	}
	return true, false
}

func SortVersionAsc(i, j Example) (equal, less bool) {
	a, b := i.info.Version, j.info.Version
	if a != b {
		return false, a.Less(b)
	}
	return true, false
}

func SortVersionDesc(i, j Example) (equal, less bool) {
	a, b := i.info.Version, j.info.Version
	if a != b {
		return false, a.Greater(b)
	}
	return true, false
}

func SortCollectionVersionAsc(i, j Example) (equal, less bool) {
	a, b := i.info.CollectionVersion, j.info.CollectionVersion
	if a != b {
		return false, a < b
	}
	return true, false
}

func SortCollectionVersionDesc(i, j Example) (equal, less bool) {
	a, b := i.info.CollectionVersion, j.info.CollectionVersion
	if a != b {
		return false, a > b
	}
	return true, false
}

func SortPathAsc(i, j Example) (equal, less bool) {
	a, b := strings.Replace(i.info.Path, "/", "\x00", -1),
		strings.Replace(j.info.Path, "/", "\x00", -1)
	if a != b {
		return false, a < b
	}
	return true, false
}

func SortPathDesc(i, j Example) (equal, less bool) {
	a, b := strings.Replace(i.info.Path, "/", "\x00", -1),
		strings.Replace(j.info.Path, "/", "\x00", -1)
	if a != b {
		return false, a > b
	}
	return true, false
}
