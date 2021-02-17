package sockjs

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
)

type frameWriter interface {
	write(writer io.Writer, frame string) (int, error)
}

type httpReceiverState int

const (
	stateHTTPReceiverActive httpReceiverState = iota
	stateHTTPReceiverClosed
)

type httpReceiver struct {
	sync.Mutex
	state httpReceiverState

	frameWriter         frameWriter
	rw                  http.ResponseWriter
	maxResponseSize     uint32
	currentResponseSize uint32
	doneCh              chan struct{}
	interruptCh         chan struct{}
	recType             ReceiverType
}

func newHTTPReceiver(rw http.ResponseWriter, req *http.Request, maxResponse uint32, frameWriter frameWriter, receiverType ReceiverType) *httpReceiver {
	recv := &httpReceiver{
		rw:              rw,
		frameWriter:     frameWriter,
		maxResponseSize: maxResponse,
		doneCh:          make(chan struct{}),
		interruptCh:     make(chan struct{}),
		recType:         receiverType,
	}
	ctx := req.Context()

	go func() {
		select {
		case <-ctx.Done():
			recv.Lock()
			defer recv.Unlock()
			if recv.state < stateHTTPReceiverClosed {
				recv.state = stateHTTPReceiverClosed
				close(recv.interruptCh)
			}
		case <-recv.doneCh:
			// ok, no action needed here, receiver closed in correct way
			// just finish the routine
		}
	}()
	return recv
}

func (recv *httpReceiver) sendBulk(messages ...string) error {
	if len(messages) > 0 {
		return recv.sendFrame(fmt.Sprintf("a[%s]",
			strings.Join(
				transform(messages, quote),
				",",
			),
		))
	}
	return nil
}

func (recv *httpReceiver) sendFrame(value string) error {
	recv.Lock()
	defer recv.Unlock()

	if recv.state == stateHTTPReceiverActive {
		n, err := recv.frameWriter.write(recv.rw, value)
		if err != nil {
			return err
		}
		recv.currentResponseSize += uint32(n)
		if recv.currentResponseSize >= recv.maxResponseSize {
			recv.state = stateHTTPReceiverClosed
			close(recv.doneCh)
		} else {
			recv.rw.(http.Flusher).Flush()
		}
	}
	return nil
}

func (recv *httpReceiver) doneNotify() <-chan struct{}        { return recv.doneCh }
func (recv *httpReceiver) interruptedNotify() <-chan struct{} { return recv.interruptCh }
func (recv *httpReceiver) close() {
	recv.Lock()
	defer recv.Unlock()
	if recv.state < stateHTTPReceiverClosed {
		recv.state = stateHTTPReceiverClosed
		close(recv.doneCh)
	}
}
func (recv *httpReceiver) canSend() bool {
	recv.Lock()
	defer recv.Unlock()
	return recv.state != stateHTTPReceiverClosed
}

func (recv *httpReceiver) receiverType() ReceiverType {
	return recv.recType
}
