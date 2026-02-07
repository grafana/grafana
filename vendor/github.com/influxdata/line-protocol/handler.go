package protocol

import (
	"bytes"
	"errors"
	"strconv"
	"time"
)

// MetricHandler implements the Handler interface and produces Metric.
type MetricHandler struct {
	timePrecision time.Duration
	timeFunc      TimeFunc
	metric        MutableMetric
}

func NewMetricHandler() *MetricHandler {
	return &MetricHandler{
		timePrecision: time.Nanosecond,
		timeFunc:      time.Now,
	}
}

func (h *MetricHandler) SetTimePrecision(p time.Duration) {
	h.timePrecision = p
	// When the timestamp is omitted from the metric, the timestamp
	// comes from the server clock, truncated to the nearest unit of
	// measurement provided in precision.
	//
	// When a timestamp is provided in the metric, precsision is
	// overloaded to hold the unit of measurement of the timestamp.
}

func (h *MetricHandler) SetTimeFunc(f TimeFunc) {
	h.timeFunc = f
}

func (h *MetricHandler) Metric() (Metric, error) {
	if h.metric.Time().IsZero() {
		h.metric.SetTime(h.timeFunc().Truncate(h.timePrecision))
	}
	return h.metric, nil
}

func (h *MetricHandler) SetMeasurement(name []byte) error {
	var err error
	h.metric, err = New(nameUnescape(name),
		nil, nil, time.Time{})
	return err
}

func (h *MetricHandler) AddTag(key []byte, value []byte) error {
	tk := unescape(key)
	tv := unescape(value)
	h.metric.AddTag(tk, tv)
	return nil
}

func (h *MetricHandler) AddInt(key []byte, value []byte) error {
	fk := unescape(key)
	fv, err := parseIntBytes(bytes.TrimSuffix(value, []byte("i")), 10, 64)
	if err != nil {
		if numerr, ok := err.(*strconv.NumError); ok {
			return numerr.Err
		}
		return err
	}
	h.metric.AddField(fk, fv)
	return nil
}

func (h *MetricHandler) AddUint(key []byte, value []byte) error {
	fk := unescape(key)
	fv, err := parseUintBytes(bytes.TrimSuffix(value, []byte("u")), 10, 64)
	if err != nil {
		if numerr, ok := err.(*strconv.NumError); ok {
			return numerr.Err
		}
		return err
	}
	h.metric.AddField(fk, fv)
	return nil
}

func (h *MetricHandler) AddFloat(key []byte, value []byte) error {
	fk := unescape(key)
	fv, err := parseFloatBytes(value, 64)
	if err != nil {
		if numerr, ok := err.(*strconv.NumError); ok {
			return numerr.Err
		}
		return err
	}
	h.metric.AddField(fk, fv)
	return nil
}

func (h *MetricHandler) AddString(key []byte, value []byte) error {
	fk := unescape(key)
	fv := stringFieldUnescape(value)
	h.metric.AddField(fk, fv)
	return nil
}

func (h *MetricHandler) AddBool(key []byte, value []byte) error {
	fk := unescape(key)
	fv, err := parseBoolBytes(value)
	if err != nil {
		return errors.New("unparseable bool")
	}
	h.metric.AddField(fk, fv)
	return nil
}

func (h *MetricHandler) SetTimestamp(tm []byte) error {
	v, err := parseIntBytes(tm, 10, 64)
	if err != nil {
		if numerr, ok := err.(*strconv.NumError); ok {
			return numerr.Err
		}
		return err
	}

	//time precision is overloaded to mean time unit here
	ns := v * int64(h.timePrecision)
	h.metric.SetTime(time.Unix(0, ns))
	return nil
}
