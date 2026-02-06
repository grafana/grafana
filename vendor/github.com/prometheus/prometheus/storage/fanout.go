// Copyright 2017 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"context"
	"log/slog"

	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/model/exemplar"
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/metadata"
	tsdb_errors "github.com/prometheus/prometheus/tsdb/errors"
)

type fanout struct {
	logger *slog.Logger

	primary     Storage
	secondaries []Storage
}

// NewFanout returns a new fanout Storage, which proxies reads and writes
// through to multiple underlying storages.
//
// The difference between primary and secondary Storage is only for read (Querier) path and it goes as follows:
// * If the primary querier returns an error, then any of the Querier operations will fail.
// * If any secondary querier returns an error the result from that queries is discarded. The overall operation will succeed,
// and the error from the secondary querier will be returned as a warning.
//
// NOTE: In the case of Prometheus, it treats all remote storages as secondary / best effort.
func NewFanout(logger *slog.Logger, primary Storage, secondaries ...Storage) Storage {
	return &fanout{
		logger:      logger,
		primary:     primary,
		secondaries: secondaries,
	}
}

// StartTime implements the Storage interface.
func (f *fanout) StartTime() (int64, error) {
	// StartTime of a fanout should be the earliest StartTime of all its storages,
	// both primary and secondaries.
	firstTime, err := f.primary.StartTime()
	if err != nil {
		return int64(model.Latest), err
	}

	for _, s := range f.secondaries {
		t, err := s.StartTime()
		if err != nil {
			return int64(model.Latest), err
		}
		if t < firstTime {
			firstTime = t
		}
	}
	return firstTime, nil
}

func (f *fanout) Querier(mint, maxt int64) (Querier, error) {
	primary, err := f.primary.Querier(mint, maxt)
	if err != nil {
		return nil, err
	}

	secondaries := make([]Querier, 0, len(f.secondaries))
	for _, storage := range f.secondaries {
		querier, err := storage.Querier(mint, maxt)
		if err != nil {
			// Close already open Queriers, append potential errors to returned error.
			errs := tsdb_errors.NewMulti(err, primary.Close())
			for _, q := range secondaries {
				errs.Add(q.Close())
			}
			return nil, errs.Err()
		}
		if _, ok := querier.(noopQuerier); !ok {
			secondaries = append(secondaries, querier)
		}
	}
	return NewMergeQuerier([]Querier{primary}, secondaries, ChainedSeriesMerge), nil
}

func (f *fanout) ChunkQuerier(mint, maxt int64) (ChunkQuerier, error) {
	primary, err := f.primary.ChunkQuerier(mint, maxt)
	if err != nil {
		return nil, err
	}

	secondaries := make([]ChunkQuerier, 0, len(f.secondaries))
	for _, storage := range f.secondaries {
		querier, err := storage.ChunkQuerier(mint, maxt)
		if err != nil {
			// Close already open Queriers, append potential errors to returned error.
			errs := tsdb_errors.NewMulti(err, primary.Close())
			for _, q := range secondaries {
				errs.Add(q.Close())
			}
			return nil, errs.Err()
		}
		secondaries = append(secondaries, querier)
	}
	return NewMergeChunkQuerier([]ChunkQuerier{primary}, secondaries, NewCompactingChunkSeriesMerger(ChainedSeriesMerge)), nil
}

func (f *fanout) Appender(ctx context.Context) Appender {
	primary := f.primary.Appender(ctx)
	secondaries := make([]Appender, 0, len(f.secondaries))
	for _, storage := range f.secondaries {
		secondaries = append(secondaries, storage.Appender(ctx))
	}
	return &fanoutAppender{
		logger:      f.logger,
		primary:     primary,
		secondaries: secondaries,
	}
}

// Close closes the storage and all its underlying resources.
func (f *fanout) Close() error {
	errs := tsdb_errors.NewMulti(f.primary.Close())
	for _, s := range f.secondaries {
		errs.Add(s.Close())
	}
	return errs.Err()
}

// fanoutAppender implements Appender.
type fanoutAppender struct {
	logger *slog.Logger

	primary     Appender
	secondaries []Appender
}

// SetOptions propagates the hints to both primary and secondary appenders.
func (f *fanoutAppender) SetOptions(opts *AppendOptions) {
	if f.primary != nil {
		f.primary.SetOptions(opts)
	}
	for _, appender := range f.secondaries {
		appender.SetOptions(opts)
	}
}

func (f *fanoutAppender) Append(ref SeriesRef, l labels.Labels, t int64, v float64) (SeriesRef, error) {
	ref, err := f.primary.Append(ref, l, t, v)
	if err != nil {
		return ref, err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.Append(ref, l, t, v); err != nil {
			return 0, err
		}
	}
	return ref, nil
}

func (f *fanoutAppender) AppendExemplar(ref SeriesRef, l labels.Labels, e exemplar.Exemplar) (SeriesRef, error) {
	ref, err := f.primary.AppendExemplar(ref, l, e)
	if err != nil {
		return ref, err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.AppendExemplar(ref, l, e); err != nil {
			return 0, err
		}
	}
	return ref, nil
}

func (f *fanoutAppender) AppendHistogram(ref SeriesRef, l labels.Labels, t int64, h *histogram.Histogram, fh *histogram.FloatHistogram) (SeriesRef, error) {
	ref, err := f.primary.AppendHistogram(ref, l, t, h, fh)
	if err != nil {
		return ref, err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.AppendHistogram(ref, l, t, h, fh); err != nil {
			return 0, err
		}
	}
	return ref, nil
}

func (f *fanoutAppender) AppendHistogramCTZeroSample(ref SeriesRef, l labels.Labels, t, ct int64, h *histogram.Histogram, fh *histogram.FloatHistogram) (SeriesRef, error) {
	ref, err := f.primary.AppendHistogramCTZeroSample(ref, l, t, ct, h, fh)
	if err != nil {
		return ref, err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.AppendHistogramCTZeroSample(ref, l, t, ct, h, fh); err != nil {
			return 0, err
		}
	}
	return ref, nil
}

func (f *fanoutAppender) UpdateMetadata(ref SeriesRef, l labels.Labels, m metadata.Metadata) (SeriesRef, error) {
	ref, err := f.primary.UpdateMetadata(ref, l, m)
	if err != nil {
		return ref, err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.UpdateMetadata(ref, l, m); err != nil {
			return 0, err
		}
	}
	return ref, nil
}

func (f *fanoutAppender) AppendCTZeroSample(ref SeriesRef, l labels.Labels, t, ct int64) (SeriesRef, error) {
	ref, err := f.primary.AppendCTZeroSample(ref, l, t, ct)
	if err != nil {
		return ref, err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.AppendCTZeroSample(ref, l, t, ct); err != nil {
			return 0, err
		}
	}
	return ref, nil
}

func (f *fanoutAppender) Commit() (err error) {
	err = f.primary.Commit()

	for _, appender := range f.secondaries {
		if err == nil {
			err = appender.Commit()
		} else {
			if rollbackErr := appender.Rollback(); rollbackErr != nil {
				f.logger.Error("Squashed rollback error on commit", "err", rollbackErr)
			}
		}
	}
	return
}

func (f *fanoutAppender) Rollback() (err error) {
	err = f.primary.Rollback()

	for _, appender := range f.secondaries {
		rollbackErr := appender.Rollback()
		switch {
		case err == nil:
			err = rollbackErr
		case rollbackErr != nil:
			f.logger.Error("Squashed rollback error on rollback", "err", rollbackErr)
		}
	}
	return nil
}
