package telebot

import "time"

var AllowedUpdates = []string{
	"message",
	"edited_message",
	"channel_post",
	"edited_channel_post",
	"message_reaction",
	"message_reaction_count",
	"inline_query",
	"chosen_inline_result",
	"callback_query",
	"shipping_query",
	"pre_checkout_query",
	"poll",
	"poll_answer",
	"my_chat_member",
	"chat_member",
	"chat_join_request",
	"chat_boost",
	"removed_chat_boost",
}

// Poller is a provider of Updates.
//
// All pollers must implement Poll(), which accepts bot
// pointer and subscription channel and start polling
// synchronously straight away.
type Poller interface {
	// Poll is supposed to take the bot object
	// subscription channel and start polling
	// for Updates immediately.
	//
	// Poller must listen for stop constantly and close
	// it as soon as it's done polling.
	Poll(b *Bot, updates chan Update, stop chan struct{})
}

// LongPoller is a classic LongPoller with timeout.
type LongPoller struct {
	Limit        int
	Timeout      time.Duration
	LastUpdateID int

	// AllowedUpdates contains the update types
	// you want your bot to receive.
	//
	// Possible values:
	//		message
	// 		edited_message
	// 		channel_post
	// 		edited_channel_post
	// 		inline_query
	// 		chosen_inline_result
	// 		callback_query
	// 		shipping_query
	// 		pre_checkout_query
	// 		poll
	// 		poll_answer
	//
	AllowedUpdates []string `yaml:"allowed_updates"`
}

// Poll does long polling.
func (p *LongPoller) Poll(b *Bot, dest chan Update, stop chan struct{}) {
	for {
		select {
		case <-stop:
			return
		default:
		}

		updates, err := b.getUpdates(p.LastUpdateID+1, p.Limit, p.Timeout, p.AllowedUpdates)
		if err != nil {
			b.debug(err)
			continue
		}

		for _, update := range updates {
			p.LastUpdateID = update.ID
			dest <- update
		}
	}
}

// MiddlewarePoller is a special kind of poller that acts
// like a filter for updates. It could be used for spam
// handling, banning or whatever.
//
// For heavy middleware, use increased capacity.
type MiddlewarePoller struct {
	Capacity int // Default: 1
	Poller   Poller
	Filter   func(*Update) bool
}

// NewMiddlewarePoller wait for it... constructs a new middleware poller.
func NewMiddlewarePoller(original Poller, filter func(*Update) bool) *MiddlewarePoller {
	return &MiddlewarePoller{
		Poller: original,
		Filter: filter,
	}
}

// Poll sieves updates through middleware filter.
func (p *MiddlewarePoller) Poll(b *Bot, dest chan Update, stop chan struct{}) {
	if p.Capacity < 1 {
		p.Capacity = 1
	}

	middle := make(chan Update, p.Capacity)
	stopPoller := make(chan struct{})
	stopConfirm := make(chan struct{})

	go func() {
		p.Poller.Poll(b, middle, stopPoller)
		close(stopConfirm)
	}()

	for {
		select {
		case <-stop:
			close(stopPoller)
			<-stopConfirm
			return
		case upd := <-middle:
			if p.Filter(&upd) {
				dest <- upd
			}
		}
	}
}
