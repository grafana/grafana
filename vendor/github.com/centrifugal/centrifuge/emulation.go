package centrifuge

import (
	"context"
	"errors"
	"io"
	"net/http"

	"github.com/centrifugal/centrifuge/internal/readerpool"

	"github.com/centrifugal/protocol"
	"github.com/segmentio/encoding/json"
)

// EmulationConfig is a config for EmulationHandler.
type EmulationConfig struct {
	// MaxRequestBodySize limits request body size (in bytes). By default we accept 64kb max.
	MaxRequestBodySize int
}

// EmulationHandler allows receiving client protocol commands from client and proxy
// them to the right node (where client session lives). This makes it possible to use
// unidirectional transports for server-to-clients data flow but still emulate
// bidirectional connection - thanks to this handler. Redirection to the correct node
// works over Survey.
type EmulationHandler struct {
	node     *Node
	config   EmulationConfig
	emuLayer *emulationLayer
}

// NewEmulationHandler creates new EmulationHandler.
func NewEmulationHandler(node *Node, config EmulationConfig) *EmulationHandler {
	return &EmulationHandler{
		node:     node,
		config:   config,
		emuLayer: newEmulationLayer(node),
	}
}

func (s *EmulationHandler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		// For pre-flight browser requests.
		rw.Header().Set("Access-Control-Max-Age", "300")
		rw.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		rw.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		rw.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	maxBytesSize := s.config.MaxRequestBodySize
	if maxBytesSize == 0 {
		maxBytesSize = 64 * 1024
	}
	r.Body = http.MaxBytesReader(rw, r.Body, int64(maxBytesSize))

	data, err := io.ReadAll(r.Body)
	if err != nil {
		s.node.logger.log(newLogEntry(LogLevelInfo, "error reading emulation request body", map[string]any{"error": err.Error()}))
		if len(data) >= maxBytesSize {
			rw.WriteHeader(http.StatusRequestEntityTooLarge)
			return
		}
		rw.WriteHeader(statusCodeClientConnectionClosed)
		return
	}

	var req protocol.EmulationRequest
	if r.Header.Get("Content-Type") == "application/octet-stream" {
		err = req.UnmarshalVT(data)
	} else {
		_, err = json.Parse(data, &req, json.ZeroCopy)
	}
	if err != nil {
		if s.node.logEnabled(LogLevelInfo) {
			s.node.logger.log(newLogEntry(LogLevelInfo, "can't unmarshal emulation request", map[string]any{"error": err.Error(), "data": string(data)}))
		}
		rw.WriteHeader(http.StatusBadRequest)
		return
	}

	err = s.emuLayer.Emulate(&req)
	if err != nil {
		s.node.logger.log(newErrorLogEntry(err, "error processing emulation request", map[string]any{"req": &req, "error": err.Error()}))
		if errors.Is(err, errNodeNotFound) {
			rw.WriteHeader(http.StatusNotFound)
		} else {
			rw.WriteHeader(http.StatusInternalServerError)
		}
		return
	}
	rw.WriteHeader(http.StatusNoContent)
}

type emulationLayer struct {
	node *Node
}

func newEmulationLayer(node *Node) *emulationLayer {
	return &emulationLayer{node: node}
}

func (l *emulationLayer) Emulate(req *protocol.EmulationRequest) error {
	return l.node.sendEmulation(req)
}

const emulationOp = "centrifuge_emulation"

var errNodeNotFound = errors.New("node not found")

func (n *Node) sendEmulation(req *protocol.EmulationRequest) error {
	_, ok := n.nodes.get(req.Node)
	if !ok {
		return errNodeNotFound
	}
	data, err := req.MarshalVT()
	if err != nil {
		return err
	}
	_, err = n.Survey(context.Background(), emulationOp, data, req.Node)
	return err
}

type emulationSurveyHandler struct {
	node *Node
}

func newEmulationSurveyHandler(node *Node) *emulationSurveyHandler {
	return &emulationSurveyHandler{node: node}
}

const (
	emulationErrorCodeBadRequest = 1
	emulationErrorCodeNoSession  = 2
)

func (h *emulationSurveyHandler) HandleEmulation(e SurveyEvent, cb SurveyCallback) {
	var req protocol.EmulationRequest
	err := req.UnmarshalVT(e.Data)
	if err != nil {
		h.node.logger.log(newErrorLogEntry(err, "error unmarshal emulation request", map[string]any{"data": string(e.Data), "error": err.Error()}))
		cb(SurveyReply{Code: emulationErrorCodeBadRequest})
		return
	}
	client, ok := h.node.Hub().clientBySession(req.Session)
	if !ok {
		cb(SurveyReply{Code: emulationErrorCodeNoSession})
		return
	}
	var data []byte
	if client.transport.Protocol() == ProtocolTypeJSON {
		var d string
		err = json.Unmarshal(req.Data, &d)
		if err != nil {
			h.node.logger.log(newErrorLogEntry(err, "error unmarshal emulation request data", map[string]any{"data": string(req.Data), "error": err.Error()}))
			cb(SurveyReply{Code: emulationErrorCodeBadRequest})
			return
		}
		data = []byte(d)
	} else {
		data = req.Data
	}
	go func() {
		reader := readerpool.GetBytesReader(data)
		_ = HandleReadFrame(client, reader)
		readerpool.PutBytesReader(reader)
		cb(SurveyReply{})
	}()
}
