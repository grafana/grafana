package gomail

import (
	"errors"
	"fmt"
	"io"
	"net/mail"
)

// Sender is the interface that wraps the Send method.
//
// Send sends an email to the given addresses.
type Sender interface {
	Send(from string, to []string, msg io.WriterTo) error
}

// SendCloser is the interface that groups the Send and Close methods.
type SendCloser interface {
	Sender
	Close() error
}

// A SendFunc is a function that sends emails to the given addresses.
//
// The SendFunc type is an adapter to allow the use of ordinary functions as
// email senders. If f is a function with the appropriate signature, SendFunc(f)
// is a Sender object that calls f.
type SendFunc func(from string, to []string, msg io.WriterTo) error

// Send calls f(from, to, msg).
func (f SendFunc) Send(from string, to []string, msg io.WriterTo) error {
	return f(from, to, msg)
}

// Send sends emails using the given Sender.
func Send(s Sender, msg ...*Message) error {
	for i, m := range msg {
		if err := send(s, m); err != nil {
			return fmt.Errorf("gomail: could not send email %d: %v", i+1, err)
		}
	}

	return nil
}

func send(s Sender, m *Message) error {
	from, err := m.getFrom()
	if err != nil {
		return err
	}

	to, err := m.getRecipients()
	if err != nil {
		return err
	}

	if err := s.Send(from, to, m); err != nil {
		return err
	}

	return nil
}

func (m *Message) getFrom() (string, error) {
	from := m.header["Sender"]
	if len(from) == 0 {
		from = m.header["From"]
		if len(from) == 0 {
			return "", errors.New(`gomail: invalid message, "From" field is absent`)
		}
	}

	return parseAddress(from[0])
}

func (m *Message) getRecipients() ([]string, error) {
	n := 0
	for _, field := range []string{"To", "Cc", "Bcc"} {
		if addresses, ok := m.header[field]; ok {
			n += len(addresses)
		}
	}
	list := make([]string, 0, n)

	for _, field := range []string{"To", "Cc", "Bcc"} {
		if addresses, ok := m.header[field]; ok {
			for _, a := range addresses {
				addr, err := parseAddress(a)
				if err != nil {
					return nil, err
				}
				list = addAddress(list, addr)
			}
		}
	}

	return list, nil
}

func addAddress(list []string, addr string) []string {
	for _, a := range list {
		if addr == a {
			return list
		}
	}

	return append(list, addr)
}

func parseAddress(field string) (string, error) {
	addr, err := mail.ParseAddress(field)
	if err != nil {
		return "", fmt.Errorf("gomail: invalid address %q: %v", field, err)
	}
	return addr.Address, nil
}
