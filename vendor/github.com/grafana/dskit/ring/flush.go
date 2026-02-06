package ring

import (
	"context"
	"errors"
)

// ErrTransferDisabled is the error returned by TransferOut when the transfers are disabled.
var ErrTransferDisabled = errors.New("transfers disabled")

// FlushTransferer controls the shutdown of an instance in the ring.
// Methods on this interface are called when lifecycler is stopping.
// At that point, it no longer runs the "actor loop", but it keeps updating heartbeat in the ring.
// Ring entry is in LEAVING state.
// After calling TransferOut and then Flush, lifecycler stops.
type FlushTransferer interface {
	Flush()
	TransferOut(ctx context.Context) error
}

// NoopFlushTransferer is a FlushTransferer which does nothing and can
// be used in cases we don't need one
type NoopFlushTransferer struct{}

// NewNoopFlushTransferer makes a new NoopFlushTransferer
func NewNoopFlushTransferer() *NoopFlushTransferer {
	return &NoopFlushTransferer{}
}

// Flush is a noop
func (t *NoopFlushTransferer) Flush() {}

// TransferOut is a noop
func (t *NoopFlushTransferer) TransferOut(_ context.Context) error {
	return nil
}
