package redis

import (
	"fmt"
	"net"
	"sync"
	"time"

	"gopkg.in/redis.v5/internal"
	"gopkg.in/redis.v5/internal/pool"
)

// PubSub implements Pub/Sub commands as described in
// http://redis.io/topics/pubsub. It's NOT safe for concurrent use by
// multiple goroutines.
type PubSub struct {
	base baseClient
	cmd  *Cmd

	mu       sync.Mutex
	channels []string
	patterns []string
}

func (c *PubSub) conn() (*pool.Conn, bool, error) {
	cn, isNew, err := c.base.conn()
	if err != nil {
		return nil, false, err
	}
	if isNew {
		c.resubscribe()
	}
	return cn, isNew, nil
}

func (c *PubSub) putConn(cn *pool.Conn, err error) {
	c.base.putConn(cn, err, true)
}

func (c *PubSub) subscribe(redisCmd string, channels ...string) error {
	args := make([]interface{}, 1+len(channels))
	args[0] = redisCmd
	for i, channel := range channels {
		args[1+i] = channel
	}
	cmd := NewSliceCmd(args...)

	cn, _, err := c.conn()
	if err != nil {
		return err
	}

	cn.SetWriteTimeout(c.base.opt.WriteTimeout)
	err = writeCmd(cn, cmd)
	c.putConn(cn, err)
	return err
}

// Subscribes the client to the specified channels.
func (c *PubSub) Subscribe(channels ...string) error {
	err := c.subscribe("SUBSCRIBE", channels...)
	if err == nil {
		c.channels = appendIfNotExists(c.channels, channels...)
	}
	return err
}

// Subscribes the client to the given patterns.
func (c *PubSub) PSubscribe(patterns ...string) error {
	err := c.subscribe("PSUBSCRIBE", patterns...)
	if err == nil {
		c.patterns = appendIfNotExists(c.patterns, patterns...)
	}
	return err
}

// Unsubscribes the client from the given channels, or from all of
// them if none is given.
func (c *PubSub) Unsubscribe(channels ...string) error {
	err := c.subscribe("UNSUBSCRIBE", channels...)
	if err == nil {
		c.channels = remove(c.channels, channels...)
	}
	return err
}

// Unsubscribes the client from the given patterns, or from all of
// them if none is given.
func (c *PubSub) PUnsubscribe(patterns ...string) error {
	err := c.subscribe("PUNSUBSCRIBE", patterns...)
	if err == nil {
		c.patterns = remove(c.patterns, patterns...)
	}
	return err
}

func (c *PubSub) Close() error {
	return c.base.Close()
}

func (c *PubSub) Ping(payload ...string) error {
	args := []interface{}{"PING"}
	if len(payload) == 1 {
		args = append(args, payload[0])
	}
	cmd := NewCmd(args...)

	cn, _, err := c.conn()
	if err != nil {
		return err
	}

	cn.SetWriteTimeout(c.base.opt.WriteTimeout)
	err = writeCmd(cn, cmd)
	c.putConn(cn, err)
	return err
}

// Message received after a successful subscription to channel.
type Subscription struct {
	// Can be "subscribe", "unsubscribe", "psubscribe" or "punsubscribe".
	Kind string
	// Channel name we have subscribed to.
	Channel string
	// Number of channels we are currently subscribed to.
	Count int
}

func (m *Subscription) String() string {
	return fmt.Sprintf("%s: %s", m.Kind, m.Channel)
}

// Message received as result of a PUBLISH command issued by another client.
type Message struct {
	Channel string
	Pattern string
	Payload string
}

func (m *Message) String() string {
	return fmt.Sprintf("Message<%s: %s>", m.Channel, m.Payload)
}

// Pong received as result of a PING command issued by another client.
type Pong struct {
	Payload string
}

func (p *Pong) String() string {
	if p.Payload != "" {
		return fmt.Sprintf("Pong<%s>", p.Payload)
	}
	return "Pong"
}

func (c *PubSub) newMessage(reply interface{}) (interface{}, error) {
	switch reply := reply.(type) {
	case string:
		return &Pong{
			Payload: reply,
		}, nil
	case []interface{}:
		switch kind := reply[0].(string); kind {
		case "subscribe", "unsubscribe", "psubscribe", "punsubscribe":
			return &Subscription{
				Kind:    kind,
				Channel: reply[1].(string),
				Count:   int(reply[2].(int64)),
			}, nil
		case "message":
			return &Message{
				Channel: reply[1].(string),
				Payload: reply[2].(string),
			}, nil
		case "pmessage":
			return &Message{
				Pattern: reply[1].(string),
				Channel: reply[2].(string),
				Payload: reply[3].(string),
			}, nil
		case "pong":
			return &Pong{
				Payload: reply[1].(string),
			}, nil
		default:
			return nil, fmt.Errorf("redis: unsupported pubsub message: %q", kind)
		}
	default:
		return nil, fmt.Errorf("redis: unsupported pubsub message: %#v", reply)
	}
}

// ReceiveTimeout acts like Receive but returns an error if message
// is not received in time. This is low-level API and most clients
// should use ReceiveMessage.
func (c *PubSub) ReceiveTimeout(timeout time.Duration) (interface{}, error) {
	if c.cmd == nil {
		c.cmd = NewCmd()
	}

	cn, _, err := c.conn()
	if err != nil {
		return nil, err
	}

	cn.SetReadTimeout(timeout)
	err = c.cmd.readReply(cn)
	c.putConn(cn, err)
	if err != nil {
		return nil, err
	}

	return c.newMessage(c.cmd.Val())
}

// Receive returns a message as a Subscription, Message, Pong or error.
// See PubSub example for details. This is low-level API and most clients
// should use ReceiveMessage.
func (c *PubSub) Receive() (interface{}, error) {
	return c.ReceiveTimeout(0)
}

// ReceiveMessage returns a Message or error ignoring Subscription or Pong
// messages. It automatically reconnects to Redis Server and resubscribes
// to channels in case of network errors.
func (c *PubSub) ReceiveMessage() (*Message, error) {
	return c.receiveMessage(5 * time.Second)
}

func (c *PubSub) receiveMessage(timeout time.Duration) (*Message, error) {
	var errNum uint
	for {
		msgi, err := c.ReceiveTimeout(timeout)
		if err != nil {
			if !internal.IsNetworkError(err) {
				return nil, err
			}

			errNum++
			if errNum < 3 {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					err := c.Ping()
					if err != nil {
						internal.Logf("PubSub.Ping failed: %s", err)
					}
				}
			} else {
				// 3 consequent errors - connection is broken or
				// Redis Server is down.
				// Sleep to not exceed max number of open connections.
				time.Sleep(time.Second)
			}
			continue
		}

		// Reset error number, because we received a message.
		errNum = 0

		switch msg := msgi.(type) {
		case *Subscription:
			// Ignore.
		case *Pong:
			// Ignore.
		case *Message:
			return msg, nil
		default:
			return nil, fmt.Errorf("redis: unknown message: %T", msgi)
		}
	}
}

func (c *PubSub) resubscribe() {
	if len(c.channels) > 0 {
		if err := c.Subscribe(c.channels...); err != nil {
			internal.Logf("Subscribe failed: %s", err)
		}
	}
	if len(c.patterns) > 0 {
		if err := c.PSubscribe(c.patterns...); err != nil {
			internal.Logf("PSubscribe failed: %s", err)
		}
	}
}

func remove(ss []string, es ...string) []string {
	if len(es) == 0 {
		return ss[:0]
	}
	for _, e := range es {
		for i, s := range ss {
			if s == e {
				ss = append(ss[:i], ss[i+1:]...)
				break
			}
		}
	}
	return ss
}

func appendIfNotExists(ss []string, es ...string) []string {
loop:
	for _, e := range es {
		for _, s := range ss {
			if s == e {
				continue loop
			}
		}
		ss = append(ss, e)
	}
	return ss
}
