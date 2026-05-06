package simple

import (
	"context"

	"github.com/grafana/grafana-app-sdk/operator"
)

// Reconciler is a simple Reconciler implementation that calls ReconcileFunc if non-nil on Reconcile requests.
type Reconciler struct {
	ReconcileFunc func(context.Context, operator.ReconcileRequest) (operator.ReconcileResult, error)
}

// Reconcile calls ReconcileFunc if non-nil and returns the response, or returns an empty ReconcileResult and nil error
// if ReconcileFunc is nil.
func (s *Reconciler) Reconcile(ctx context.Context, req operator.ReconcileRequest) (operator.ReconcileResult, error) {
	if s.ReconcileFunc != nil {
		return s.ReconcileFunc(ctx, req)
	}
	return operator.ReconcileResult{}, nil
}

// Compile-time interface compliance check
var _ operator.Reconciler = &Reconciler{}
