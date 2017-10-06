// Copyright 2013 Flo Lauber <dev@qatfy.at>.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// TODO(flo):
//   - support password protected MUC rooms
//   - cleanup signatures of join/leave functions
package xmpp

import (
	"errors"
	"fmt"
	"time"
)

const (
	nsMUC          = "http://jabber.org/protocol/muc"
	nsMUCUser      = "http://jabber.org/protocol/muc#user"
	NoHistory      = 0
	CharHistory    = 1
	StanzaHistory  = 2
	SecondsHistory = 3
	SinceHistory   = 4
)

// Send sends room topic wrapped inside an XMPP message stanza body.
func (c *Client) SendTopic(chat Chat) (n int, err error) {
	return fmt.Fprintf(c.conn, "<message to='%s' type='%s' xml:lang='en'>"+"<subject>%s</subject></message>",
		xmlEscape(chat.Remote), xmlEscape(chat.Type), xmlEscape(chat.Text))
}

func (c *Client) JoinMUCNoHistory(jid, nick string) (n int, err error) {
	if nick == "" {
		nick = c.jid
	}
	return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
		"<x xmlns='%s'>"+
		"<history maxchars='0'/></x>\n"+
		"</presence>",
		xmlEscape(jid), xmlEscape(nick), nsMUC)
}

// xep-0045 7.2
func (c *Client) JoinMUC(jid, nick string, history_type, history int, history_date *time.Time) (n int, err error) {
	if nick == "" {
		nick = c.jid
	}
	switch history_type {
	case NoHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s' />\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC)
	case CharHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s'>\n"+
			"<history maxchars='%d'/></x>\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC, history)
	case StanzaHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s'>\n"+
			"<history maxstanzas='%d'/></x>\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC, history)
	case SecondsHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s'>\n"+
			"<history seconds='%d'/></x>\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC, history)
	case SinceHistory:
		if history_date != nil {
			return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
				"<x xmlns='%s'>\n"+
				"<history since='%s'/></x>\n"+
				"</presence>",
				xmlEscape(jid), xmlEscape(nick), nsMUC, history_date.Format(time.RFC3339))
		}
	}
	return 0, errors.New("Unknown history option")
}

// xep-0045 7.2.6
func (c *Client) JoinProtectedMUC(jid, nick string, password string, history_type, history int, history_date *time.Time) (n int, err error) {
	if nick == "" {
		nick = c.jid
	}
	switch history_type {
	case NoHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s'>\n"+
			"<password>%s</password>"+
			"</x>\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC, xmlEscape(password))
	case CharHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s'>\n"+
			"<password>%s</password>\n"+
			"<history maxchars='%d'/></x>\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC, xmlEscape(password), history)
	case StanzaHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s'>\n"+
			"<password>%s</password>\n"+
			"<history maxstanzas='%d'/></x>\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC, xmlEscape(password), history)
	case SecondsHistory:
		return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
			"<x xmlns='%s'>\n"+
			"<password>%s</password>\n"+
			"<history seconds='%d'/></x>\n"+
			"</presence>",
			xmlEscape(jid), xmlEscape(nick), nsMUC, xmlEscape(password), history)
	case SinceHistory:
		if history_date != nil {
			return fmt.Fprintf(c.conn, "<presence to='%s/%s'>\n"+
				"<x xmlns='%s'>\n"+
				"<password>%s</password>\n"+
				"<history since='%s'/></x>\n"+
				"</presence>",
				xmlEscape(jid), xmlEscape(nick), nsMUC, xmlEscape(password), history_date.Format(time.RFC3339))
		}
	}
	return 0, errors.New("Unknown history option")
}

// xep-0045 7.14
func (c *Client) LeaveMUC(jid string) (n int, err error) {
	return fmt.Fprintf(c.conn, "<presence from='%s' to='%s' type='unavailable' />",
		c.jid, xmlEscape(jid))
}
