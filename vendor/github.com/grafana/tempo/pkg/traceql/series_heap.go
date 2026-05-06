package traceql

// seriesValue keeps a value from a time series with its key
type seriesValue struct {
	key   string
	value float64
}

// seriesHeap implements a min-heap of seriesValue
type seriesHeap []seriesValue

func (h seriesHeap) Len() int { return len(h) }

func (h seriesHeap) Less(i, j int) bool { return h[i].value < h[j].value }

func (h seriesHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h *seriesHeap) Push(x interface{}) {
	*h = append(*h, x.(seriesValue))
}

func (h *seriesHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

// reverseSeriesHeap implements a max-heap of seriesValue
type reverseSeriesHeap []seriesValue

func (h reverseSeriesHeap) Len() int { return len(h) }

func (h reverseSeriesHeap) Less(i, j int) bool { return h[i].value > h[j].value }

func (h reverseSeriesHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h *reverseSeriesHeap) Push(x interface{}) {
	*h = append(*h, x.(seriesValue))
}

func (h *reverseSeriesHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}
