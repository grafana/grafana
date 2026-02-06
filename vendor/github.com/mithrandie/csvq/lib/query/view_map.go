package query

import (
	"context"
	"errors"
	"strings"

	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

var errTableNotLoaded = errors.New("table not loaded")

type ViewMap struct {
	*SyncMap
}

func NewViewMap() ViewMap {
	return ViewMap{
		NewSyncMap(),
	}
}

func (m ViewMap) IsEmpty() bool {
	return m.SyncMap == nil
}

func (m ViewMap) Store(identifier string, view *View) {
	m.store(identifier, view)
}

func (m ViewMap) LoadDirect(identifier string) (interface{}, bool) {
	return m.load(identifier)
}

func (m ViewMap) Load(identifier string) (*View, bool) {
	if v, ok := m.load(identifier); ok {
		return v.(*View), true
	}
	return nil, false
}

func (m ViewMap) Delete(identifier string) {
	m.delete(identifier)
}

func (m ViewMap) Exists(identifier string) bool {
	return m.exists(identifier)
}

func (m ViewMap) Get(identifier string) (*View, error) {
	if view, ok := m.Load(identifier); ok {
		return view.Copy(), nil
	}
	return nil, errTableNotLoaded
}

func (m ViewMap) GetWithInternalId(ctx context.Context, identifier string, flags *option.Flags) (*View, error) {
	if view, ok := m.Load(identifier); ok {
		ret := view.Copy()

		ret.Header = NewHeaderWithId(ret.Header[0].View, []string{}).Merge(ret.Header)

		if err := NewGoroutineTaskManager(ret.RecordLen(), -1, flags.CPU).Run(ctx, func(index int) error {
			record := make(Record, len(ret.RecordSet[index])+1)
			record[0] = NewCell(value.NewInteger(int64(index)))
			for i := 0; i < len(ret.RecordSet[index]); i++ {
				record[i+1] = ret.RecordSet[index][i]
			}
			ret.RecordSet[index] = record
			return nil
		}); err != nil {
			return nil, err
		}

		return ret, nil
	}
	return nil, errTableNotLoaded
}

func (m ViewMap) Set(view *View) {
	if view.FileInfo != nil {
		m.Store(view.FileInfo.IdentifiedPath(), view)
	}
}

func (m ViewMap) DisposeTemporaryTable(tablePath parser.QueryExpression) bool {
	identifier := func() string {
		if e, ok := tablePath.(parser.Stdin); ok {
			return e.String()
		}
		return strings.ToUpper(tablePath.(parser.Identifier).Literal)
	}()

	if v, ok := m.Load(identifier); ok && v.FileInfo.IsInMemoryTable() {
		m.Delete(identifier)
		return true
	}
	return false
}

func (m ViewMap) Dispose(container *file.Container, identifier string) error {
	if view, ok := m.Load(identifier); ok {
		if view.FileInfo.Handler != nil {
			if err := container.Close(view.FileInfo.Handler); err != nil {
				return err
			}
		}
		m.Delete(identifier)
	}
	return nil
}

func (m ViewMap) Clean(container *file.Container) error {
	keys := m.Keys()
	for _, k := range keys {
		if err := m.Dispose(container, k); err != nil {
			return err
		}
	}
	return nil
}

func (m ViewMap) CleanWithErrors(container *file.Container) error {
	keys := m.Keys()
	var errs []error
	for _, k := range keys {
		if view, ok := m.Load(k); ok {
			if err := container.CloseWithErrors(view.FileInfo.Handler); err != nil {
				errs = append(errs, err.(*file.ForcedUnlockError).Errors...)
			}
			m.Delete(k)
		}
	}

	return file.NewForcedUnlockError(errs)
}
