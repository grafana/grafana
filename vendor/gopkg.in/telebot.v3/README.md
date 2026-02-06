# Telebot
>"I never knew creating Telegram bots could be so _sexy_!"

[![GoDoc](https://godoc.org/gopkg.in/telebot.v3?status.svg)](https://godoc.org/gopkg.in/telebot.v3)
[![GitHub Actions](https://github.com/tucnak/telebot/actions/workflows/go.yml/badge.svg)](https://github.com/tucnak/telebot/actions)
[![codecov.io](https://codecov.io/gh/tucnak/telebot/coverage.svg?branch=v3)](https://codecov.io/gh/tucnak/telebot)
[![Discuss on Telegram](https://img.shields.io/badge/telegram-discuss-0088cc.svg)](https://t.me/go_telebot)

```bash
go get -u gopkg.in/telebot.v3
```

* [Overview](#overview)
* [Getting Started](#getting-started)
	- [Context](#context)
	- [Middleware](#middleware)
	- [Poller](#poller)
	- [Commands](#commands)
	- [Files](#files)
	- [Sendable](#sendable)
	- [Editable](#editable)
	- [Keyboards](#keyboards)
	- [Inline mode](#inline-mode)
* [Contributing](#contributing)
* [Donate](#donate)
* [License](#license)

# Overview
Telebot is a bot framework for [Telegram Bot API](https://core.telegram.org/bots/api).
This package provides the best of its kind API for command routing, inline query requests and keyboards, as well
as callbacks. Actually, I went a couple steps further, so instead of making a 1:1 API wrapper I chose to focus on
the beauty of API and performance. Some strong sides of Telebot are:

* Real concise API
* Command routing
* Middleware
* Transparent File API
* Effortless bot callbacks

All the methods of Telebot API are _extremely_ easy to memorize and get used to. Also, consider Telebot a
highload-ready solution. I'll test and benchmark the most popular actions and if necessary, optimize
against them without sacrificing API quality.

# Getting Started
Let's take a look at the minimal Telebot setup:

```go
package main

import (
	"log"
	"os"
	"time"

	tele "gopkg.in/telebot.v3"
)

func main() {
	pref := tele.Settings{
		Token:  os.Getenv("TOKEN"),
		Poller: &tele.LongPoller{Timeout: 10 * time.Second},
	}

	b, err := tele.NewBot(pref)
	if err != nil {
		log.Fatal(err)
		return
	}

	b.Handle("/hello", func(c tele.Context) error {
		return c.Send("Hello!")
	})

	b.Start()
}

```

Simple, innit? Telebot's routing system takes care of delivering updates
to their endpoints, so in order to get to handle any meaningful event,
all you got to do is just plug your function into one of the Telebot-provided
endpoints. You can find the full list
[here](https://godoc.org/gopkg.in/telebot.v3#pkg-constants).

There are dozens of supported endpoints (see package consts). Let me know
if you'd like to see some endpoint or endpoint ideas implemented. This system
is completely extensible, so I can introduce them without breaking
backwards compatibility.

## Context
Context is a special type that wraps a huge update structure and represents
the context of the current event. It provides several helpers, which allow
getting, for example, the chat that this update had been sent in, no matter
what kind of update this is.

```go
b.Handle(tele.OnText, func(c tele.Context) error {
	// All the text messages that weren't
	// captured by existing handlers.

	var (
		user = c.Sender()
		text = c.Text()
	)

	// Use full-fledged bot's functions
	// only if you need a result:
	msg, err := b.Send(user, text)
	if err != nil {
		return err
	}

	// Instead, prefer a context short-hand:
	return c.Send(text)
})

b.Handle(tele.OnChannelPost, func(c tele.Context) error {
	// Channel posts only.
	msg := c.Message()
})

b.Handle(tele.OnPhoto, func(c tele.Context) error {
	// Photos only.
	photo := c.Message().Photo
})

b.Handle(tele.OnQuery, func(c tele.Context) error {
	// Incoming inline queries.
	return c.Answer(...)
})
```

## Middleware
Telebot has a simple and recognizable way to set up middleware — chained functions with access to `Context`, called before the handler execution.

Import a `middleware` package to get some basic out-of-box middleware
implementations:
```go
import "gopkg.in/telebot.v3/middleware"
```

```go
// Global-scoped middleware:
b.Use(middleware.Logger())
b.Use(middleware.AutoRespond())

// Group-scoped middleware:
adminOnly := b.Group()
adminOnly.Use(middleware.Whitelist(adminIDs...))
adminOnly.Handle("/ban", onBan)
adminOnly.Handle("/kick", onKick)

// Handler-scoped middleware:
b.Handle(tele.OnText, onText, middleware.IgnoreVia())
```

Custom middleware example:
```go
// AutoResponder automatically responds to every callback update.
func AutoResponder(next tele.HandlerFunc) tele.HandlerFunc {
	return func(c tele.Context) error {
		if c.Callback() != nil {
			defer c.Respond()
		}
		return next(c) // continue execution chain
	}
}
```

## Poller
Telebot doesn't really care how you provide it with incoming updates, as long
as you set it up with a Poller, or call ProcessUpdate for each update:

```go
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
```

## Commands
When handling commands, Telebot supports both direct (`/command`) and group-like
syntax (`/command@botname`) and will never deliver messages addressed to some
other bot, even if [privacy mode](https://core.telegram.org/bots#privacy-mode) is off.

For simplified deep-linking, Telebot also extracts payload:
```go
// Command: /start <PAYLOAD>
b.Handle("/start", func(c tele.Context) error {
	fmt.Println(c.Message().Payload) // <PAYLOAD>
})
```

For multiple arguments use:
```go
// Command: /tags <tag1> <tag2> <...>
b.Handle("/tags", func(c tele.Context) error {
	tags := c.Args() // list of arguments splitted by a space
	for _, tag := range tags {
		// iterate through passed arguments
	}
})
```

## Files
>Telegram allows files up to 50 MB in size.

Telebot allows to both upload (from disk or by URL) and download (from Telegram)
files in bot's scope. Also, sending any kind of media with a File created
from disk will upload the file to Telegram automatically:
```go
a := &tele.Audio{File: tele.FromDisk("file.ogg")}

fmt.Println(a.OnDisk()) // true
fmt.Println(a.InCloud()) // false

// Will upload the file from disk and send it to the recipient
b.Send(recipient, a)

// Next time you'll be sending this very *Audio, Telebot won't
// re-upload the same file but rather utilize its Telegram FileID
b.Send(otherRecipient, a)

fmt.Println(a.OnDisk()) // true
fmt.Println(a.InCloud()) // true
fmt.Println(a.FileID) // <Telegram file ID>
```

You might want to save certain `File`s in order to avoid re-uploading. Feel free
to marshal them into whatever format, `File` only contain public fields, so no
data will ever be lost.

## Sendable
Send is undoubtedly the most important method in Telebot. `Send()` accepts a
`Recipient` (could be user, group or a channel) and a `Sendable`. Other types other than
the Telebot-provided media types (`Photo`, `Audio`, `Video`, etc.) are `Sendable`.
If you create composite types of your own, and they satisfy the `Sendable` interface,
Telebot will be able to send them out.

```go
// Sendable is any object that can send itself.
//
// This is pretty cool, since it lets bots implement
// custom Sendables for complex kinds of media or
// chat objects spanning across multiple messages.
type Sendable interface {
	Send(*Bot, Recipient, *SendOptions) (*Message, error)
}
```

The only type at the time that doesn't fit `Send()` is `Album` and there is a reason
for that. Albums were added not so long ago, so they are slightly quirky for backwards
compatibilities sake. In fact, an `Album` can be sent, but never received. Instead,
Telegram returns a `[]Message`, one for each media object in the album:
```go
p := &tele.Photo{File: tele.FromDisk("chicken.jpg")}
v := &tele.Video{File: tele.FromURL("http://video.mp4")}

msgs, err := b.SendAlbum(user, tele.Album{p, v})
```

### Send options
Send options are objects and flags you can pass to `Send()`, `Edit()` and friends
as optional arguments (following the recipient and the text/media). The most
important one is called `SendOptions`, it lets you control _all_ the properties of
the message supported by Telegram. The only drawback is that it's rather
inconvenient to use at times, so `Send()` supports multiple shorthands:
```go
// regular send options
b.Send(user, "text", &tele.SendOptions{
	// ...
})

// ReplyMarkup is a part of SendOptions,
// but often it's the only option you need
b.Send(user, "text", &tele.ReplyMarkup{
	// ...
})

// flags: no notification && no web link preview
b.Send(user, "text", tele.Silent, tele.NoPreview)
```

Full list of supported option-flags you can find
[here](https://pkg.go.dev/gopkg.in/telebot.v3#Option).

## Editable
If you want to edit some existing message, you don't really need to store the
original `*Message` object. In fact, upon edit, Telegram only requires `chat_id`
and `message_id`. So you don't really need the Message as a whole. Also, you
might want to store references to certain messages in the database, so I thought
it made sense for *any* Go struct to be editable as a Telegram message, to implement
`Editable`:
```go
// Editable is an interface for all objects that
// provide "message signature", a pair of 32-bit
// message ID and 64-bit chat ID, both required
// for edit operations.
//
// Use case: DB model struct for messages to-be
// edited with, say two columns: msg_id,chat_id
// could easily implement MessageSig() making
// instances of stored messages editable.
type Editable interface {
	// MessageSig is a "message signature".
	//
	// For inline messages, return chatID = 0.
	MessageSig() (messageID int, chatID int64)
}
```

For example, `Message` type is Editable. Here is the implementation of `StoredMessage`
type, provided by Telebot:
```go
// StoredMessage is an example struct suitable for being
// stored in the database as-is or being embedded into
// a larger struct, which is often the case (you might
// want to store some metadata alongside, or might not.)
type StoredMessage struct {
	MessageID int   `sql:"message_id" json:"message_id"`
	ChatID    int64 `sql:"chat_id" json:"chat_id"`
}

func (x StoredMessage) MessageSig() (int, int64) {
	return x.MessageID, x.ChatID
}
```

Why bother at all? Well, it allows you to do things like this:
```go
// just two integer columns in the database
var msgs []tele.StoredMessage
db.Find(&msgs) // gorm syntax

for _, msg := range msgs {
	bot.Edit(&msg, "Updated text")
	// or
	bot.Delete(&msg)
}
```

I find it incredibly neat. Worth noting, at this point of time there exists
another method in the Edit family, `EditCaption()` which is of a pretty
rare use, so I didn't bother including it to `Edit()`, just like I did with
`SendAlbum()` as it would inevitably lead to unnecessary complications.
```go
var m *Message

// change caption of a photo, audio, etc.
bot.EditCaption(m, "new caption")
```

## Keyboards
Telebot supports both kinds of keyboards Telegram provides: reply and inline
keyboards. Any button can also act as endpoints for `Handle()`.

```go
var (
	// Universal markup builders.
	menu     = &tele.ReplyMarkup{ResizeKeyboard: true}
	selector = &tele.ReplyMarkup{}

	// Reply buttons.
	btnHelp     = menu.Text("ℹ Help")
	btnSettings = menu.Text("⚙ Settings")

	// Inline buttons.
	//
	// Pressing it will cause the client to
	// send the bot a callback.
	//
	// Make sure Unique stays unique as per button kind
	// since it's required for callback routing to work.
	//
	btnPrev = selector.Data("⬅", "prev", ...)
	btnNext = selector.Data("➡", "next", ...)
)

menu.Reply(
	menu.Row(btnHelp),
	menu.Row(btnSettings),
)
selector.Inline(
	selector.Row(btnPrev, btnNext),
)

b.Handle("/start", func(c tele.Context) error {
	return c.Send("Hello!", menu)
})

// On reply button pressed (message)
b.Handle(&btnHelp, func(c tele.Context) error {
	return c.Edit("Here is some help: ...")
})

// On inline button pressed (callback)
b.Handle(&btnPrev, func(c tele.Context) error {
	return c.Respond()
})
```

You can use markup constructor for every type of possible button:
```go
r := b.NewMarkup()

// Reply buttons:
r.Text("Hello!")
r.Contact("Send phone number")
r.Location("Send location")
r.Poll(tele.PollQuiz)

// Inline buttons:
r.Data("Show help", "help") // data is optional
r.Data("Delete item", "delete", item.ID)
r.URL("Visit", "https://google.com")
r.Query("Search", query)
r.QueryChat("Share", query)
r.Login("Login", &tele.Login{...})
```

## Inline mode
So if you want to handle incoming inline queries you better plug the `tele.OnQuery`
endpoint and then use the `Answer()` method to send a list of inline queries
back. I think at the time of writing, Telebot supports all of the provided result
types (but not the cached ones). This is what it looks like:

```go
b.Handle(tele.OnQuery, func(c tele.Context) error {
	urls := []string{
		"http://photo.jpg",
		"http://photo2.jpg",
	}

	results := make(tele.Results, len(urls)) // []tele.Result
	for i, url := range urls {
		result := &tele.PhotoResult{
			URL:      url,
			ThumbURL: url, // required for photos
		}

		results[i] = result
		// needed to set a unique string ID for each result
		results[i].SetResultID(strconv.Itoa(i))
	}

	return c.Answer(&tele.QueryResponse{
		Results:   results,
		CacheTime: 60, // a minute
	})
})
```

There's not much to talk about really. It also supports some form of authentication
through deep-linking. For that, use fields `SwitchPMText` and `SwitchPMParameter`
of `QueryResponse`.

# Contributing

1. Fork it
2. Clone v3: `git clone -b v3 https://github.com/tucnak/telebot`
3. Create your feature branch: `git checkout -b v3-feature`
4. Make changes and add them: `git add .`
5. Commit: `git commit -m "add some feature"`
6. Push: `git push origin v3-feature`
7. Pull request

# Donate

I do coding for fun, but I also try to search for interesting solutions and
optimize them as much as possible.
If you feel like it's a good piece of software, I wouldn't mind a tip!

Litecoin: `ltc1qskt5ltrtyg7esfjm0ftx6jnacwffhpzpqmerus`

Ethereum: `0xB78A2Ac1D83a0aD0b993046F9fDEfC5e619efCAB`

# License

Telebot is distributed under MIT.
