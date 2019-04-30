package chromedp

import (
	"context"
	"io"

	"github.com/chromedp/cdproto"
)

// Transport is the common interface to send/receive messages to a target.
type Transport interface {
	Read(context.Context, *cdproto.Message) error
	Write(context.Context, *cdproto.Message) error
	io.Closer
}
