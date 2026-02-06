package simple

import (
	"context"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
)

// Watcher is a struct that implements operator.ResourceWatcher and SyncWatcher, but takes no action on its own.
// For each method in (Add, Update, Delete) the corresponding exported function field is called, if non-nil.
type Watcher struct {
	AddFunc    func(context.Context, resource.Object) error
	UpdateFunc func(context.Context, resource.Object, resource.Object) error
	DeleteFunc func(context.Context, resource.Object) error
	SyncFunc   func(context.Context, resource.Object) error
}

// Add calls AddFunc, if non-nil
func (w *Watcher) Add(ctx context.Context, object resource.Object) error {
	if w.AddFunc != nil {
		return w.AddFunc(ctx, object)
	}
	return nil
}

// Update calls UpdateFunc, if non-nil
func (w *Watcher) Update(ctx context.Context, src resource.Object, tgt resource.Object) error {
	if w.UpdateFunc != nil {
		return w.UpdateFunc(ctx, src, tgt)
	}
	return nil
}

// Delete calls DeleteFunc, if non-nil
func (w *Watcher) Delete(ctx context.Context, object resource.Object) error {
	if w.DeleteFunc != nil {
		return w.DeleteFunc(ctx, object)
	}
	return nil
}

// Sync calls SyncFunc, if non-nil
func (w *Watcher) Sync(ctx context.Context, object resource.Object) error {
	if w.SyncFunc != nil {
		return w.SyncFunc(ctx, object)
	}
	return nil
}

// Compile-time interface compliance checks
var _ operator.ResourceWatcher = &Watcher{}
var _ SyncWatcher = &Watcher{}
