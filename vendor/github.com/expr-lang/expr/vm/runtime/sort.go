package runtime

type SortBy struct {
	Desc   bool
	Array  []any
	Values []any
}

func (s *SortBy) Len() int {
	return len(s.Array)
}

func (s *SortBy) Swap(i, j int) {
	s.Array[i], s.Array[j] = s.Array[j], s.Array[i]
	s.Values[i], s.Values[j] = s.Values[j], s.Values[i]
}

func (s *SortBy) Less(i, j int) bool {
	a, b := s.Values[i], s.Values[j]
	if s.Desc {
		return Less(b, a)
	}
	return Less(a, b)
}

type Sort struct {
	Desc  bool
	Array []any
}

func (s *Sort) Len() int {
	return len(s.Array)
}

func (s *Sort) Swap(i, j int) {
	s.Array[i], s.Array[j] = s.Array[j], s.Array[i]
}

func (s *Sort) Less(i, j int) bool {
	a, b := s.Array[i], s.Array[j]
	if s.Desc {
		return Less(b, a)
	}
	return Less(a, b)
}
