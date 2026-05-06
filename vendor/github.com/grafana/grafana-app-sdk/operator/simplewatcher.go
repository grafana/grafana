package operator

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

// SimpleWatcher is a struct that implements ResourceWatcher, but takes no action on its own.
// For each method in (Add, Update, Delete) the corresponding exported function field is called, if non-nil.
type SimpleWatcher struct {
	AddFunc    func(context.Context, resource.Object) error
	UpdateFunc func(context.Context, resource.Object, resource.Object) error
	DeleteFunc func(context.Context, resource.Object) error
}

// Add calls AddFunc, if non-nil
func (w *SimpleWatcher) Add(ctx context.Context, object resource.Object) error {
	if w.AddFunc != nil {
		return w.AddFunc(ctx, object)
	}
	return nil
}

// Update calls UpdateFunc, if non-nil
func (w *SimpleWatcher) Update(ctx context.Context, src resource.Object, tgt resource.Object) error {
	if w.UpdateFunc != nil {
		return w.UpdateFunc(ctx, src, tgt)
	}
	return nil
}

// Delete calls DeleteFunc, if non-nil
func (w *SimpleWatcher) Delete(ctx context.Context, object resource.Object) error {
	if w.DeleteFunc != nil {
		return w.DeleteFunc(ctx, object)
	}
	return nil
}
