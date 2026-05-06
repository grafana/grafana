package util

type GenerationalMap[K comparable, V any] struct {
	oldgen map[K]V
	newgen map[K]V

	maxSize int
	newV    func() V
	gcCb    func()
}

// NewGenMap created which maintains at most maxSize recently used entries
func NewGenMap[K comparable, V any](maxSize int, newV func() V, gcCb func()) GenerationalMap[K, V] {
	return GenerationalMap[K, V]{
		newgen:  make(map[K]V),
		maxSize: maxSize,
		newV:    newV,
		gcCb:    gcCb,
	}
}

func (m *GenerationalMap[K, T]) GetOrCreate(key K) T {
	v, ok := m.newgen[key]
	if !ok {
		if v, ok = m.oldgen[key]; !ok {
			v = m.newV()
		}
		m.newgen[key] = v

		if len(m.newgen) == m.maxSize {
			m.oldgen = m.newgen
			m.newgen = make(map[K]T)
			if m.gcCb != nil {
				m.gcCb()
			}
		}
	}
	return v
}
