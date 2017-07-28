package trace

type TraceRecorder interface {
	T() *Recorder
}

func GetRecorder(v interface{}) (*Recorder, bool) {
	rg, ok := v.(TraceRecorder)
	if ok {
		return rg.T(), ok
	}
	return nil, false
}

func SafeRecorder(v interface{}) *Recorder {
	rg, ok := v.(TraceRecorder)
	if ok {
		return rg.T()
	}
	return DummyRecorder
}
