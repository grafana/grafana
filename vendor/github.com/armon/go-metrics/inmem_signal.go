package metrics

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
)

// InmemSignal is used to listen for a given signal, and when received,
// to dump the current metrics from the InmemSink to an io.Writer
type InmemSignal struct {
	signal syscall.Signal
	inm    *InmemSink
	w      io.Writer
	sigCh  chan os.Signal

	stop     bool
	stopCh   chan struct{}
	stopLock sync.Mutex
}

// NewInmemSignal creates a new InmemSignal which listens for a given signal,
// and dumps the current metrics out to a writer
func NewInmemSignal(inmem *InmemSink, sig syscall.Signal, w io.Writer) *InmemSignal {
	i := &InmemSignal{
		signal: sig,
		inm:    inmem,
		w:      w,
		sigCh:  make(chan os.Signal, 1),
		stopCh: make(chan struct{}),
	}
	signal.Notify(i.sigCh, sig)
	go i.run()
	return i
}

// DefaultInmemSignal returns a new InmemSignal that responds to SIGUSR1
// and writes output to stderr. Windows uses SIGBREAK
func DefaultInmemSignal(inmem *InmemSink) *InmemSignal {
	return NewInmemSignal(inmem, DefaultSignal, os.Stderr)
}

// Stop is used to stop the InmemSignal from listening
func (i *InmemSignal) Stop() {
	i.stopLock.Lock()
	defer i.stopLock.Unlock()

	if i.stop {
		return
	}
	i.stop = true
	close(i.stopCh)
	signal.Stop(i.sigCh)
}

// run is a long running routine that handles signals
func (i *InmemSignal) run() {
	for {
		select {
		case <-i.sigCh:
			i.dumpStats()
		case <-i.stopCh:
			return
		}
	}
}

// dumpStats is used to dump the data to output writer
func (i *InmemSignal) dumpStats() {
	buf := bytes.NewBuffer(nil)

	data := i.inm.Data()
	// Skip the last period which is still being aggregated
	for j := 0; j < len(data)-1; j++ {
		intv := data[j]
		intv.RLock()
		for _, val := range intv.Gauges {
			name := i.flattenLabels(val.Name, val.Labels)
			fmt.Fprintf(buf, "[%v][G] '%s': %0.3f\n", intv.Interval, name, val.Value)
		}
		for name, vals := range intv.Points {
			for _, val := range vals {
				fmt.Fprintf(buf, "[%v][P] '%s': %0.3f\n", intv.Interval, name, val)
			}
		}
		for _, agg := range intv.Counters {
			name := i.flattenLabels(agg.Name, agg.Labels)
			fmt.Fprintf(buf, "[%v][C] '%s': %s\n", intv.Interval, name, agg.AggregateSample)
		}
		for _, agg := range intv.Samples {
			name := i.flattenLabels(agg.Name, agg.Labels)
			fmt.Fprintf(buf, "[%v][S] '%s': %s\n", intv.Interval, name, agg.AggregateSample)
		}
		intv.RUnlock()
	}

	// Write out the bytes
	i.w.Write(buf.Bytes())
}

// Flattens the key for formatting along with its labels, removes spaces
func (i *InmemSignal) flattenLabels(name string, labels []Label) string {
	buf := bytes.NewBufferString(name)
	replacer := strings.NewReplacer(" ", "_", ":", "_")

	for _, label := range labels {
		replacer.WriteString(buf, ".")
		replacer.WriteString(buf, label.Value)
	}

	return buf.String()
}
