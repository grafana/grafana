package graphql

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	webSocketMethod         = "websocket"
	webSocketTypeConnInit   = "connection_init"
	webSocketTypeConnAck    = "connection_ack"
	webSocketTypeSubscribe  = "subscribe"
	webSocketTypeNext       = "next"
	webSocketTypeError      = "error"
	webSocketTypeComplete   = "complete"
	websocketConnAckTimeOut = time.Second * 30
)

// Close codes defined in RFC 6455, section 11.7.
const (
	closeNormalClosure    = 1000
	closeNoStatusReceived = 1005
)

// The message types are defined in RFC 6455, section 11.8.
const (
	// textMessage denotes a text data message. The text message payload is
	// interpreted as UTF-8 encoded text data.
	textMessage = 1

	// closeMessage denotes a close control message. The optional message
	// payload contains a numeric code and text. Use the FormatCloseMessage
	// function to format a close message payload.
	closeMessage = 8
)

type webSocketClient struct {
	Dialer        Dialer
	header        http.Header
	endpoint      string
	conn          WSConn
	connParams    map[string]interface{}
	errChan       chan error
	subscriptions subscriptionMap
	isClosing     bool
	sync.Mutex
}

type webSocketInitMessage struct {
	Payload map[string]interface{} `json:"payload"`
	Type    string                 `json:"type"`
}

type webSocketSendMessage struct {
	Payload *Request `json:"payload"`
	Type    string   `json:"type"`
	ID      string   `json:"id"`
}

type webSocketReceiveMessage struct {
	Type    string          `json:"type"`
	ID      string          `json:"id"`
	Payload json.RawMessage `json:"payload"`
}

func (w *webSocketClient) sendInit() error {
	connInitMsg := webSocketInitMessage{
		Type:    webSocketTypeConnInit,
		Payload: w.connParams,
	}
	return w.sendStructAsJSON(connInitMsg)
}

func (w *webSocketClient) sendStructAsJSON(object any) error {
	jsonBytes, err := json.Marshal(object)
	if err != nil {
		return err
	}
	return w.conn.WriteMessage(textMessage, jsonBytes)
}

func (w *webSocketClient) waitForConnAck() error {
	var connAckReceived bool
	var err error
	start := time.Now()
	for !connAckReceived {
		connAckReceived, err = w.receiveWebSocketConnAck()
		if err != nil {
			return err
		}
		if time.Since(start) > websocketConnAckTimeOut {
			return fmt.Errorf("timed out while waiting for connAck (> %v)", websocketConnAckTimeOut)
		}
	}
	return nil
}

func (w *webSocketClient) handleErr(err error) {
	w.Lock()
	defer w.Unlock()
	if !w.isClosing {
		w.errChan <- err
	}
}

func (w *webSocketClient) listenWebSocket() {
	for {
		if w.isClosing {
			return
		}
		_, message, err := w.conn.ReadMessage()
		if err != nil {
			w.handleErr(err)
			return
		}
		err = w.forwardWebSocketData(message)
		if err != nil {
			w.handleErr(err)
			return
		}
	}
}

func (w *webSocketClient) forwardWebSocketData(message []byte) error {
	var wsMsg webSocketReceiveMessage
	err := json.Unmarshal(message, &wsMsg)
	if err != nil {
		return err
	}
	sub, ok := w.subscriptions.Read(wsMsg.ID)
	if !ok {
		return fmt.Errorf("received message for unknown subscription ID '%s'", wsMsg.ID)
	}
	if sub.hasBeenUnsubscribed {
		return nil
	}
	if wsMsg.Type == webSocketTypeComplete {
		reflect.ValueOf(sub.interfaceChan).Close()
		return nil
	}

	return sub.forwardDataFunc(sub.interfaceChan, wsMsg.Payload)
}

func (w *webSocketClient) receiveWebSocketConnAck() (bool, error) {
	_, message, err := w.conn.ReadMessage()
	if err != nil {
		return false, err
	}
	return checkConnectionAckReceived(message)
}

func checkConnectionAckReceived(message []byte) (bool, error) {
	wsMessage := &webSocketSendMessage{}
	err := json.Unmarshal(message, wsMessage)
	if err != nil {
		return false, err
	}
	return wsMessage.Type == webSocketTypeConnAck, nil
}

func (w *webSocketClient) Start(ctx context.Context) (errChan chan error, err error) {
	w.conn, err = w.Dialer.DialContext(ctx, w.endpoint, w.header)
	if err != nil {
		return nil, err
	}
	err = w.sendInit()
	if err != nil {
		w.conn.Close()
		return nil, err
	}
	err = w.waitForConnAck()
	if err != nil {
		w.conn.Close()
		return nil, err
	}
	go w.listenWebSocket()
	return w.errChan, err
}

func (w *webSocketClient) Close() error {
	if w.conn == nil {
		return nil
	}
	err := w.conn.WriteMessage(closeMessage, formatCloseMessage(closeNormalClosure, ""))
	if err != nil {
		return fmt.Errorf("failed to send closure message: %w", err)
	}
	err = w.UnsubscribeAll()
	if err != nil {
		return fmt.Errorf("failed to unsubscribe: %w", err)
	}
	w.Lock()
	defer w.Unlock()
	w.isClosing = true
	close(w.errChan)
	return w.conn.Close()
}

func (w *webSocketClient) Subscribe(req *Request, interfaceChan interface{}, forwardDataFunc ForwardDataFunction) (string, error) {
	if req.Query != "" {
		if strings.HasPrefix(strings.TrimSpace(req.Query), "query") {
			return "", fmt.Errorf("client does not support queries")
		}
		if strings.HasPrefix(strings.TrimSpace(req.Query), "mutation") {
			return "", fmt.Errorf("client does not support mutations")
		}
	}

	subscriptionID := uuid.NewString()
	w.subscriptions.Create(subscriptionID, interfaceChan, forwardDataFunc)
	subscriptionMsg := webSocketSendMessage{
		Type:    webSocketTypeSubscribe,
		Payload: req,
		ID:      subscriptionID,
	}
	err := w.sendStructAsJSON(subscriptionMsg)
	if err != nil {
		w.subscriptions.Delete(subscriptionID)
		return "", err
	}
	return subscriptionID, nil
}

func (w *webSocketClient) Unsubscribe(subscriptionID string) error {
	completeMsg := webSocketSendMessage{
		Type: webSocketTypeComplete,
		ID:   subscriptionID,
	}
	err := w.sendStructAsJSON(completeMsg)
	if err != nil {
		return err
	}
	err = w.subscriptions.Unsubscribe(subscriptionID)
	if err != nil {
		return err
	}
	return nil
}

func (w *webSocketClient) UnsubscribeAll() error {
	subscriptionIDs := w.subscriptions.GetAllIDs()
	for _, subscriptionID := range subscriptionIDs {
		err := w.Unsubscribe(subscriptionID)
		if err != nil {
			return err
		}
	}
	return nil
}

// formatCloseMessage formats closeCode and text as a WebSocket close message.
// An empty message is returned for code CloseNoStatusReceived.
func formatCloseMessage(closeCode int, text string) []byte {
	if closeCode == closeNoStatusReceived {
		// Return empty message because it's illegal to send
		// CloseNoStatusReceived. Return non-nil value in case application
		// checks for nil.
		return []byte{}
	}
	buf := make([]byte, 2+len(text))
	binary.BigEndian.PutUint16(buf, uint16(closeCode))
	copy(buf[2:], text)
	return buf
}
