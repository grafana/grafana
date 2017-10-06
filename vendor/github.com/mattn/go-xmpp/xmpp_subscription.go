package xmpp

import (
	"fmt"
)

func (c *Client) ApproveSubscription(jid string) {
	fmt.Fprintf(c.conn, "<presence to='%s' type='subscribed'/>",
		xmlEscape(jid))
}

func (c *Client) RevokeSubscription(jid string) {
	fmt.Fprintf(c.conn, "<presence to='%s' type='unsubscribed'/>",
		xmlEscape(jid))
}

func (c *Client) RequestSubscription(jid string) {
	fmt.Fprintf(c.conn, "<presence to='%s' type='subscribe'/>",
		xmlEscape(jid))
}
