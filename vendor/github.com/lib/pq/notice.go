// +build go1.10

package pq

import (
	"context"
	"database/sql/driver"
)

// NoticeHandler returns the notice handler on the given connection, if any. A
// runtime panic occurs if c is not a pq connection. This is rarely used
// directly, use ConnectorNoticeHandler and ConnectorWithNoticeHandler instead.
func NoticeHandler(c driver.Conn) func(*Error) {
	return c.(*conn).noticeHandler
}

// SetNoticeHandler sets the given notice handler on the given connection. A
// runtime panic occurs if c is not a pq connection. A nil handler may be used
// to unset it. This is rarely used directly, use ConnectorNoticeHandler and
// ConnectorWithNoticeHandler instead.
//
// Note: Notice handlers are executed synchronously by pq meaning commands
// won't continue to be processed until the handler returns.
func SetNoticeHandler(c driver.Conn, handler func(*Error)) {
	c.(*conn).noticeHandler = handler
}

// NoticeHandlerConnector wraps a regular connector and sets a notice handler
// on it.
type NoticeHandlerConnector struct {
	driver.Connector
	noticeHandler func(*Error)
}

// Connect calls the underlying connector's connect method and then sets the
// notice handler.
func (n *NoticeHandlerConnector) Connect(ctx context.Context) (driver.Conn, error) {
	c, err := n.Connector.Connect(ctx)
	if err == nil {
		SetNoticeHandler(c, n.noticeHandler)
	}
	return c, err
}

// ConnectorNoticeHandler returns the currently set notice handler, if any. If
// the given connector is not a result of ConnectorWithNoticeHandler, nil is
// returned.
func ConnectorNoticeHandler(c driver.Connector) func(*Error) {
	if c, ok := c.(*NoticeHandlerConnector); ok {
		return c.noticeHandler
	}
	return nil
}

// ConnectorWithNoticeHandler creates or sets the given handler for the given
// connector. If the given connector is a result of calling this function
// previously, it is simply set on the given connector and returned. Otherwise,
// this returns a new connector wrapping the given one and setting the notice
// handler. A nil notice handler may be used to unset it.
//
// The returned connector is intended to be used with database/sql.OpenDB.
//
// Note: Notice handlers are executed synchronously by pq meaning commands
// won't continue to be processed until the handler returns.
func ConnectorWithNoticeHandler(c driver.Connector, handler func(*Error)) *NoticeHandlerConnector {
	if c, ok := c.(*NoticeHandlerConnector); ok {
		c.noticeHandler = handler
		return c
	}
	return &NoticeHandlerConnector{Connector: c, noticeHandler: handler}
}
