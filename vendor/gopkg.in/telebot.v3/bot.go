package telebot

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// NewBot does try to build a Bot with token `token`, which
// is a secret API key assigned to particular bot.
func NewBot(pref Settings) (*Bot, error) {
	if pref.Updates == 0 {
		pref.Updates = 100
	}

	client := pref.Client
	if client == nil {
		client = &http.Client{Timeout: time.Minute}
	}

	if pref.URL == "" {
		pref.URL = DefaultApiURL
	}
	if pref.Poller == nil {
		pref.Poller = &LongPoller{}
	}
	if pref.OnError == nil {
		pref.OnError = defaultOnError
	}

	bot := &Bot{
		Token:   pref.Token,
		URL:     pref.URL,
		Poller:  pref.Poller,
		onError: pref.OnError,

		Updates:  make(chan Update, pref.Updates),
		handlers: make(map[string]HandlerFunc),
		stop:     make(chan chan struct{}),

		synchronous: pref.Synchronous,
		verbose:     pref.Verbose,
		parseMode:   pref.ParseMode,
		client:      client,
	}

	if pref.Offline {
		bot.Me = &User{}
	} else {
		user, err := bot.getMe()
		if err != nil {
			return nil, err
		}
		bot.Me = user
	}

	bot.group = bot.Group()
	return bot, nil
}

// Bot represents a separate Telegram bot instance.
type Bot struct {
	Me      *User
	Token   string
	URL     string
	Updates chan Update
	Poller  Poller
	onError func(error, Context)

	group       *Group
	handlers    map[string]HandlerFunc
	synchronous bool
	verbose     bool
	parseMode   ParseMode
	stop        chan chan struct{}
	client      *http.Client
	stopClient  chan struct{}
}

// Settings represents a utility struct for passing certain
// properties of a bot around and is required to make bots.
type Settings struct {
	URL   string
	Token string

	// Updates channel capacity, defaulted to 100.
	Updates int

	// Poller is the provider of Updates.
	Poller Poller

	// Synchronous prevents handlers from running in parallel.
	// It makes ProcessUpdate return after the handler is finished.
	Synchronous bool

	// Verbose forces bot to log all upcoming requests.
	// Use for debugging purposes only.
	Verbose bool

	// ParseMode used to set default parse mode of all sent messages.
	// It attaches to every send, edit or whatever method. You also
	// will be able to override the default mode by passing a new one.
	ParseMode ParseMode

	// OnError is a callback function that will get called on errors
	// resulted from the handler. It is used as post-middleware function.
	// Notice that context can be nil.
	OnError func(error, Context)

	// HTTP Client used to make requests to telegram api
	Client *http.Client

	// Offline allows to create a bot without network for testing purposes.
	Offline bool
}

var defaultOnError = func(err error, c Context) {
	if c != nil {
		log.Println(c.Update().ID, err)
	} else {
		log.Println(err)
	}
}

func (b *Bot) OnError(err error, c Context) {
	b.onError(err, c)
}

func (b *Bot) debug(err error) {
	if b.verbose {
		b.OnError(err, nil)
	}
}

// Group returns a new group.
func (b *Bot) Group() *Group {
	return &Group{b: b}
}

// Use adds middleware to the global bot chain.
func (b *Bot) Use(middleware ...MiddlewareFunc) {
	b.group.Use(middleware...)
}

var (
	cmdRx   = regexp.MustCompile(`^(/\w+)(@(\w+))?(\s|$)(.+)?`)
	cbackRx = regexp.MustCompile(`^\f([-\w]+)(\|(.+))?$`)
)

// Handle lets you set the handler for some command name or
// one of the supported endpoints. It also applies middleware
// if such passed to the function.
//
// Example:
//
//	b.Handle("/start", func (c tele.Context) error {
//		return c.Reply("Hello!")
//	})
//
//	b.Handle(&inlineButton, func (c tele.Context) error {
//		return c.Respond(&tele.CallbackResponse{Text: "Hello!"})
//	})
//
// Middleware usage:
//
//	b.Handle("/ban", onBan, middleware.Whitelist(ids...))
func (b *Bot) Handle(endpoint interface{}, h HandlerFunc, m ...MiddlewareFunc) {
	if len(b.group.middleware) > 0 {
		m = appendMiddleware(b.group.middleware, m)
	}

	handler := func(c Context) error {
		return applyMiddleware(h, m...)(c)
	}

	switch end := endpoint.(type) {
	case string:
		b.handlers[end] = handler
	case CallbackEndpoint:
		b.handlers[end.CallbackUnique()] = handler
	default:
		panic("telebot: unsupported endpoint")
	}
}

// Start brings bot into motion by consuming incoming
// updates (see Bot.Updates channel).
func (b *Bot) Start() {
	if b.Poller == nil {
		panic("telebot: can't start without a poller")
	}

	// do nothing if called twice
	if b.stopClient != nil {
		return
	}
	b.stopClient = make(chan struct{})

	stop := make(chan struct{})
	stopConfirm := make(chan struct{})

	go func() {
		b.Poller.Poll(b, b.Updates, stop)
		close(stopConfirm)
	}()

	for {
		select {
		// handle incoming updates
		case upd := <-b.Updates:
			b.ProcessUpdate(upd)
			// call to stop polling
		case confirm := <-b.stop:
			close(stop)
			<-stopConfirm
			close(confirm)
			b.stopClient = nil
			return
		}
	}
}

// Stop gracefully shuts the poller down.
func (b *Bot) Stop() {
	if b.stopClient != nil {
		close(b.stopClient)
	}
	confirm := make(chan struct{})
	b.stop <- confirm
	<-confirm
}

// NewMarkup simply returns newly created markup instance.
func (b *Bot) NewMarkup() *ReplyMarkup {
	return &ReplyMarkup{}
}

// NewContext returns a new native context object,
// field by the passed update.
func (b *Bot) NewContext(u Update) Context {
	return &nativeContext{
		b: b,
		u: u,
	}
}

// Send accepts 2+ arguments, starting with destination chat, followed by
// some Sendable (or string!) and optional send options.
//
// NOTE:
//
//	Since most arguments are of type interface{}, but have pointer
//	method receivers, make sure to pass them by-pointer, NOT by-value.
//
// What is a send option exactly? It can be one of the following types:
//
//   - *SendOptions (the actual object accepted by Telegram API)
//   - *ReplyMarkup (a component of SendOptions)
//   - Option (a shortcut flag for popular options)
//   - ParseMode (HTML, Markdown, etc)
func (b *Bot) Send(to Recipient, what interface{}, opts ...interface{}) (*Message, error) {
	if to == nil {
		return nil, ErrBadRecipient
	}

	sendOpts := extractOptions(opts)

	switch object := what.(type) {
	case string:
		return b.sendText(to, object, sendOpts)
	case Sendable:
		return object.Send(b, to, sendOpts)
	default:
		return nil, ErrUnsupportedWhat
	}
}

// SendAlbum sends multiple instances of media as a single message.
// To include the caption, make sure the first Inputtable of an album has it.
// From all existing options, it only supports tele.Silent.
func (b *Bot) SendAlbum(to Recipient, a Album, opts ...interface{}) ([]Message, error) {
	if to == nil {
		return nil, ErrBadRecipient
	}

	sendOpts := extractOptions(opts)
	media := make([]string, len(a))
	files := make(map[string]File)

	for i, x := range a {
		var (
			repr string
			data []byte
			file = x.MediaFile()
		)

		switch {
		case file.InCloud():
			repr = file.FileID
		case file.FileURL != "":
			repr = file.FileURL
		case file.OnDisk() || file.FileReader != nil:
			repr = "attach://" + strconv.Itoa(i)
			files[strconv.Itoa(i)] = *file
		default:
			return nil, fmt.Errorf("telebot: album entry #%d does not exist", i)
		}

		im := x.InputMedia()
		im.Media = repr

		if len(sendOpts.Entities) > 0 {
			im.Entities = sendOpts.Entities
		} else {
			im.ParseMode = sendOpts.ParseMode
		}

		data, _ = json.Marshal(im)
		media[i] = string(data)
	}

	params := map[string]string{
		"chat_id": to.Recipient(),
		"media":   "[" + strings.Join(media, ",") + "]",
	}
	b.embedSendOptions(params, sendOpts)

	data, err := b.sendFiles("sendMediaGroup", files, params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result []Message
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}

	for attachName := range files {
		i, _ := strconv.Atoi(attachName)
		r := resp.Result[i]

		var newID string
		switch {
		case r.Photo != nil:
			newID = r.Photo.FileID
		case r.Video != nil:
			newID = r.Video.FileID
		case r.Audio != nil:
			newID = r.Audio.FileID
		case r.Document != nil:
			newID = r.Document.FileID
		}

		a[i].MediaFile().FileID = newID
	}

	return resp.Result, nil
}

// Reply behaves just like Send() with an exception of "reply-to" indicator.
// This function will panic upon nil Message.
func (b *Bot) Reply(to *Message, what interface{}, opts ...interface{}) (*Message, error) {
	sendOpts := extractOptions(opts)
	if sendOpts == nil {
		sendOpts = &SendOptions{}
	}

	sendOpts.ReplyTo = to
	return b.Send(to.Chat, what, sendOpts)
}

// Forward behaves just like Send() but of all options it only supports Silent (see Bots API).
// This function will panic upon nil Editable.
func (b *Bot) Forward(to Recipient, msg Editable, opts ...interface{}) (*Message, error) {
	if to == nil {
		return nil, ErrBadRecipient
	}
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"chat_id":      to.Recipient(),
		"from_chat_id": strconv.FormatInt(chatID, 10),
		"message_id":   msgID,
	}

	sendOpts := extractOptions(opts)
	b.embedSendOptions(params, sendOpts)

	data, err := b.Raw("forwardMessage", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Copy behaves just like Forward() but the copied message doesn't have a link to the original message (see Bots API).
//
// This function will panic upon nil Editable.
func (b *Bot) Copy(to Recipient, msg Editable, options ...interface{}) (*Message, error) {
	if to == nil {
		return nil, ErrBadRecipient
	}
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"chat_id":      to.Recipient(),
		"from_chat_id": strconv.FormatInt(chatID, 10),
		"message_id":   msgID,
	}

	sendOpts := extractOptions(options)
	b.embedSendOptions(params, sendOpts)

	data, err := b.Raw("copyMessage", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Edit is magic, it lets you change already sent message.
// This function will panic upon nil Editable.
//
// If edited message is sent by the bot, returns it,
// otherwise returns nil and ErrTrueResult.
//
// Use cases:
//
//	b.Edit(m, m.Text, newMarkup)
//	b.Edit(m, "new <b>text</b>", tele.ModeHTML)
//	b.Edit(m, &tele.ReplyMarkup{...})
//	b.Edit(m, &tele.Photo{File: ...})
//	b.Edit(m, tele.Location{42.1337, 69.4242})
//	b.Edit(c, "edit inline message from the callback")
//	b.Edit(r, "edit message from chosen inline result")
func (b *Bot) Edit(msg Editable, what interface{}, opts ...interface{}) (*Message, error) {
	var (
		method string
		params = make(map[string]string)
	)

	switch v := what.(type) {
	case *ReplyMarkup:
		return b.EditReplyMarkup(msg, v)
	case Inputtable:
		return b.EditMedia(msg, v, opts...)
	case string:
		method = "editMessageText"
		params["text"] = v
	case Location:
		method = "editMessageLiveLocation"
		params["latitude"] = fmt.Sprintf("%f", v.Lat)
		params["longitude"] = fmt.Sprintf("%f", v.Lng)

		if v.HorizontalAccuracy != nil {
			params["horizontal_accuracy"] = fmt.Sprintf("%f", *v.HorizontalAccuracy)
		}
		if v.Heading != 0 {
			params["heading"] = strconv.Itoa(v.Heading)
		}
		if v.AlertRadius != 0 {
			params["proximity_alert_radius"] = strconv.Itoa(v.AlertRadius)
		}
	default:
		return nil, ErrUnsupportedWhat
	}

	msgID, chatID := msg.MessageSig()

	if chatID == 0 { // if inline message
		params["inline_message_id"] = msgID
	} else {
		params["chat_id"] = strconv.FormatInt(chatID, 10)
		params["message_id"] = msgID
	}

	sendOpts := extractOptions(opts)
	b.embedSendOptions(params, sendOpts)

	data, err := b.Raw(method, params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// EditReplyMarkup edits reply markup of already sent message.
// This function will panic upon nil Editable.
// Pass nil or empty ReplyMarkup to delete it from the message.
//
// If edited message is sent by the bot, returns it,
// otherwise returns nil and ErrTrueResult.
func (b *Bot) EditReplyMarkup(msg Editable, markup *ReplyMarkup) (*Message, error) {
	msgID, chatID := msg.MessageSig()
	params := make(map[string]string)

	if chatID == 0 { // if inline message
		params["inline_message_id"] = msgID
	} else {
		params["chat_id"] = strconv.FormatInt(chatID, 10)
		params["message_id"] = msgID
	}

	if markup == nil {
		// will delete reply markup
		markup = &ReplyMarkup{}
	}

	processButtons(markup.InlineKeyboard)
	data, _ := json.Marshal(markup)
	params["reply_markup"] = string(data)

	data, err := b.Raw("editMessageReplyMarkup", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// EditCaption edits already sent photo caption with known recipient and message id.
// This function will panic upon nil Editable.
//
// If edited message is sent by the bot, returns it,
// otherwise returns nil and ErrTrueResult.
func (b *Bot) EditCaption(msg Editable, caption string, opts ...interface{}) (*Message, error) {
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"caption": caption,
	}

	if chatID == 0 { // if inline message
		params["inline_message_id"] = msgID
	} else {
		params["chat_id"] = strconv.FormatInt(chatID, 10)
		params["message_id"] = msgID
	}

	sendOpts := extractOptions(opts)
	b.embedSendOptions(params, sendOpts)

	data, err := b.Raw("editMessageCaption", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// EditMedia edits already sent media with known recipient and message id.
// This function will panic upon nil Editable.
//
// If edited message is sent by the bot, returns it,
// otherwise returns nil and ErrTrueResult.
//
// Use cases:
//
//	b.EditMedia(m, &tele.Photo{File: tele.FromDisk("chicken.jpg")})
//	b.EditMedia(m, &tele.Video{File: tele.FromURL("http://video.mp4")})
func (b *Bot) EditMedia(msg Editable, media Inputtable, opts ...interface{}) (*Message, error) {
	var (
		repr  string
		file  = media.MediaFile()
		files = make(map[string]File)

		thumb     *Photo
		thumbName = "thumb"
	)

	switch {
	case file.InCloud():
		repr = file.FileID
	case file.FileURL != "":
		repr = file.FileURL
	case file.OnDisk() || file.FileReader != nil:
		s := file.FileLocal
		if file.FileReader != nil {
			s = "0"
		} else if s == thumbName {
			thumbName = "thumb2"
		}

		repr = "attach://" + s
		files[s] = *file
	default:
		return nil, fmt.Errorf("telebot: cannot edit media, it does not exist")
	}

	switch m := media.(type) {
	case *Video:
		thumb = m.Thumbnail
	case *Audio:
		thumb = m.Thumbnail
	case *Document:
		thumb = m.Thumbnail
	case *Animation:
		thumb = m.Thumbnail
	}

	msgID, chatID := msg.MessageSig()
	params := make(map[string]string)

	sendOpts := extractOptions(opts)
	b.embedSendOptions(params, sendOpts)

	im := media.InputMedia()
	im.Media = repr

	if len(sendOpts.Entities) > 0 {
		im.Entities = sendOpts.Entities
	} else {
		im.ParseMode = sendOpts.ParseMode
	}

	if thumb != nil {
		im.Thumbnail = "attach://" + thumbName
		files[thumbName] = *thumb.MediaFile()
	}

	data, _ := json.Marshal(im)
	params["media"] = string(data)

	if chatID == 0 { // if inline message
		params["inline_message_id"] = msgID
	} else {
		params["chat_id"] = strconv.FormatInt(chatID, 10)
		params["message_id"] = msgID
	}

	data, err := b.sendFiles("editMessageMedia", files, params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Delete removes the message, including service messages.
// This function will panic upon nil Editable.
//
//   - A message can only be deleted if it was sent less than 48 hours ago.
//   - A dice message in a private chat can only be deleted if it was sent more than 24 hours ago.
//   - Bots can delete outgoing messages in private chats, groups, and supergroups.
//   - Bots can delete incoming messages in private chats.
//   - Bots granted can_post_messages permissions can delete outgoing messages in channels.
//   - If the bot is an administrator of a group, it can delete any message there.
//   - If the bot has can_delete_messages permission in a supergroup or a
//     channel, it can delete any message there.
func (b *Bot) Delete(msg Editable) error {
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"chat_id":    strconv.FormatInt(chatID, 10),
		"message_id": msgID,
	}

	_, err := b.Raw("deleteMessage", params)
	return err
}

// Notify updates the chat action for recipient.
//
// Chat action is a status message that recipient would see where
// you typically see "Harry is typing" status message. The only
// difference is that bots' chat actions live only for 5 seconds
// and die just once the client receives a message from the bot.
//
// Currently, Telegram supports only a narrow range of possible
// actions, these are aligned as constants of this package.
func (b *Bot) Notify(to Recipient, action ChatAction, threadID ...int) error {
	if to == nil {
		return ErrBadRecipient
	}

	params := map[string]string{
		"chat_id": to.Recipient(),
		"action":  string(action),
	}

	if len(threadID) > 0 {
		params["message_thread_id"] = strconv.Itoa(threadID[0])
	}

	_, err := b.Raw("sendChatAction", params)
	return err
}

// Ship replies to the shipping query, if you sent an invoice
// requesting an address and the parameter is_flexible was specified.
//
// Example:
//
//	b.Ship(query)          // OK
//	b.Ship(query, opts...) // OK with options
//	b.Ship(query, "Oops!") // Error message
func (b *Bot) Ship(query *ShippingQuery, what ...interface{}) error {
	params := map[string]string{
		"shipping_query_id": query.ID,
	}

	if len(what) == 0 {
		params["ok"] = "true"
	} else if s, ok := what[0].(string); ok {
		params["ok"] = "false"
		params["error_message"] = s
	} else {
		var opts []ShippingOption
		for _, v := range what {
			opt, ok := v.(ShippingOption)
			if !ok {
				return ErrUnsupportedWhat
			}
			opts = append(opts, opt)
		}

		params["ok"] = "true"
		data, _ := json.Marshal(opts)
		params["shipping_options"] = string(data)
	}

	_, err := b.Raw("answerShippingQuery", params)
	return err
}

// Accept finalizes the deal.
func (b *Bot) Accept(query *PreCheckoutQuery, errorMessage ...string) error {
	params := map[string]string{
		"pre_checkout_query_id": query.ID,
	}

	if len(errorMessage) == 0 {
		params["ok"] = "true"
	} else {
		params["ok"] = "False"
		params["error_message"] = errorMessage[0]
	}

	_, err := b.Raw("answerPreCheckoutQuery", params)
	return err
}

// Respond sends a response for a given callback query. A callback can
// only be responded to once, subsequent attempts to respond to the same callback
// will result in an error.
//
// Example:
//
//	b.Respond(c)
//	b.Respond(c, response)
func (b *Bot) Respond(c *Callback, resp ...*CallbackResponse) error {
	var r *CallbackResponse
	if resp == nil {
		r = &CallbackResponse{}
	} else {
		r = resp[0]
	}

	r.CallbackID = c.ID
	_, err := b.Raw("answerCallbackQuery", r)
	return err
}

// Answer sends a response for a given inline query. A query can only
// be responded to once, subsequent attempts to respond to the same query
// will result in an error.
func (b *Bot) Answer(query *Query, resp *QueryResponse) error {
	resp.QueryID = query.ID

	for _, result := range resp.Results {
		result.Process(b)
	}

	_, err := b.Raw("answerInlineQuery", resp)
	return err
}

// AnswerWebApp sends a response for a query from Web App and returns
// information about an inline message sent by a Web App on behalf of a user
func (b *Bot) AnswerWebApp(query *Query, r Result) (*WebAppMessage, error) {
	r.Process(b)

	params := map[string]interface{}{
		"web_app_query_id": query.ID,
		"result":           r,
	}

	data, err := b.Raw("answerWebAppQuery", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *WebAppMessage
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}

	return resp.Result, err
}

// FileByID returns full file object including File.FilePath, allowing you to
// download the file from the server.
//
// Usually, Telegram-provided File objects miss FilePath so you might need to
// perform an additional request to fetch them.
func (b *Bot) FileByID(fileID string) (File, error) {
	params := map[string]string{
		"file_id": fileID,
	}

	data, err := b.Raw("getFile", params)
	if err != nil {
		return File{}, err
	}

	var resp struct {
		Result File
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return File{}, wrapError(err)
	}
	return resp.Result, nil
}

// Download saves the file from Telegram servers locally.
// Maximum file size to download is 20 MB.
func (b *Bot) Download(file *File, localFilename string) error {
	reader, err := b.File(file)
	if err != nil {
		return err
	}
	defer reader.Close()

	out, err := os.Create(localFilename)
	if err != nil {
		return wrapError(err)
	}
	defer out.Close()

	_, err = io.Copy(out, reader)
	if err != nil {
		return wrapError(err)
	}

	file.FileLocal = localFilename
	return nil
}

// File gets a file from Telegram servers.
func (b *Bot) File(file *File) (io.ReadCloser, error) {
	f, err := b.FileByID(file.FileID)
	if err != nil {
		return nil, err
	}

	url := b.URL + "/file/bot" + b.Token + "/" + f.FilePath
	file.FilePath = f.FilePath // saving file path

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, wrapError(err)
	}

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, wrapError(err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("telebot: expected status 200 but got %s", resp.Status)
	}

	return resp.Body, nil
}

// StopLiveLocation stops broadcasting live message location
// before Location.LivePeriod expires.
//
// It supports ReplyMarkup.
// This function will panic upon nil Editable.
//
// If the message is sent by the bot, returns it,
// otherwise returns nil and ErrTrueResult.
func (b *Bot) StopLiveLocation(msg Editable, opts ...interface{}) (*Message, error) {
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"chat_id":    strconv.FormatInt(chatID, 10),
		"message_id": msgID,
	}

	sendOpts := extractOptions(opts)
	b.embedSendOptions(params, sendOpts)

	data, err := b.Raw("stopMessageLiveLocation", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// StopPoll stops a poll which was sent by the bot and returns
// the stopped Poll object with the final results.
//
// It supports ReplyMarkup.
// This function will panic upon nil Editable.
func (b *Bot) StopPoll(msg Editable, opts ...interface{}) (*Poll, error) {
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"chat_id":    strconv.FormatInt(chatID, 10),
		"message_id": msgID,
	}

	sendOpts := extractOptions(opts)
	b.embedSendOptions(params, sendOpts)

	data, err := b.Raw("stopPoll", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *Poll
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// Leave makes bot leave a group, supergroup or channel.
func (b *Bot) Leave(chat *Chat) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	_, err := b.Raw("leaveChat", params)
	return err
}

// Pin pins a message in a supergroup or a channel.
//
// It supports Silent option.
// This function will panic upon nil Editable.
func (b *Bot) Pin(msg Editable, opts ...interface{}) error {
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"chat_id":    strconv.FormatInt(chatID, 10),
		"message_id": msgID,
	}

	sendOpts := extractOptions(opts)
	b.embedSendOptions(params, sendOpts)

	_, err := b.Raw("pinChatMessage", params)
	return err
}

// Unpin unpins a message in a supergroup or a channel.
// It supports tb.Silent option.
func (b *Bot) Unpin(chat *Chat, messageID ...int) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}
	if len(messageID) > 0 {
		params["message_id"] = strconv.Itoa(messageID[0])
	}

	_, err := b.Raw("unpinChatMessage", params)
	return err
}

// UnpinAll unpins all messages in a supergroup or a channel.
// It supports tb.Silent option.
func (b *Bot) UnpinAll(chat *Chat) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	_, err := b.Raw("unpinAllChatMessages", params)
	return err
}

// ChatByID fetches chat info of its ID.
//
// Including current name of the user for one-on-one conversations,
// current username of a user, group or channel, etc.
func (b *Bot) ChatByID(id int64) (*Chat, error) {
	return b.ChatByUsername(strconv.FormatInt(id, 10))
}

// ChatByUsername fetches chat info by its username.
func (b *Bot) ChatByUsername(name string) (*Chat, error) {
	params := map[string]string{
		"chat_id": name,
	}

	data, err := b.Raw("getChat", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *Chat
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	if resp.Result.Type == ChatChannel && resp.Result.Username == "" {
		resp.Result.Type = ChatChannelPrivate
	}
	return resp.Result, nil
}

// ProfilePhotosOf returns list of profile pictures for a user.
func (b *Bot) ProfilePhotosOf(user *User) ([]Photo, error) {
	params := map[string]string{
		"user_id": user.Recipient(),
	}

	data, err := b.Raw("getUserProfilePhotos", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result struct {
			Count  int     `json:"total_count"`
			Photos []Photo `json:"photos"`
		}
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result.Photos, nil
}

// ChatMemberOf returns information about a member of a chat.
func (b *Bot) ChatMemberOf(chat, user Recipient) (*ChatMember, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
		"user_id": user.Recipient(),
	}

	data, err := b.Raw("getChatMember", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *ChatMember
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// MenuButton returns the current value of the bot's menu button in a private chat,
// or the default menu button.
func (b *Bot) MenuButton(chat *User) (*MenuButton, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	data, err := b.Raw("getChatMenuButton", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *MenuButton
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// SetMenuButton changes the bot's menu button in a private chat,
// or the default menu button.
//
// It accepts two kinds of menu button arguments:
//
//   - MenuButtonType for simple menu buttons (default, commands)
//   - MenuButton complete structure for web_app menu button type
func (b *Bot) SetMenuButton(chat *User, mb interface{}) error {
	params := map[string]interface{}{
		"chat_id": chat.Recipient(),
	}

	switch v := mb.(type) {
	case MenuButtonType:
		params["menu_button"] = MenuButton{Type: v}
	case *MenuButton:
		params["menu_button"] = v
	}

	_, err := b.Raw("setChatMenuButton", params)
	return err
}

// Logout logs out from the cloud Bot API server before launching the bot locally.
func (b *Bot) Logout() (bool, error) {
	data, err := b.Raw("logOut", nil)
	if err != nil {
		return false, err
	}

	var resp struct {
		Result bool `json:"result"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return false, wrapError(err)
	}

	return resp.Result, nil
}

// Close closes the bot instance before moving it from one local server to another.
func (b *Bot) Close() (bool, error) {
	data, err := b.Raw("close", nil)
	if err != nil {
		return false, err
	}

	var resp struct {
		Result bool `json:"result"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return false, wrapError(err)
	}

	return resp.Result, nil
}
