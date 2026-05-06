package telebot

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ReplyMarkup controls two convenient options for bot-user communications
// such as reply keyboard and inline "keyboard" (a grid of buttons as a part
// of the message).
type ReplyMarkup struct {
	// InlineKeyboard is a grid of InlineButtons displayed in the message.
	//
	// Note: DO NOT confuse with ReplyKeyboard and other keyboard properties!
	InlineKeyboard [][]InlineButton `json:"inline_keyboard,omitempty"`

	// ReplyKeyboard is a grid, consisting of keyboard buttons.
	//
	// Note: you don't need to set HideCustomKeyboard field to show custom keyboard.
	ReplyKeyboard [][]ReplyButton `json:"keyboard,omitempty"`

	// ForceReply forces Telegram clients to display
	// a reply interface to the user (act as if the user
	// has selected the bot‘s message and tapped "Reply").
	ForceReply bool `json:"force_reply,omitempty"`

	// Requests clients to resize the keyboard vertically for optimal fit
	// (e.g. make the keyboard smaller if there are just two rows of buttons).
	//
	// Defaults to false, in which case the custom keyboard is always of the
	// same height as the app's standard keyboard.
	ResizeKeyboard bool `json:"resize_keyboard,omitempty"`

	// Requests clients to hide the reply keyboard as soon as it's been used.
	//
	// Defaults to false.
	OneTimeKeyboard bool `json:"one_time_keyboard,omitempty"`

	// Requests clients to remove the reply keyboard.
	//
	// Defaults to false.
	RemoveKeyboard bool `json:"remove_keyboard,omitempty"`

	// Use this param if you want to force reply from
	// specific users only.
	//
	// Targets:
	// 1) Users that are @mentioned in the text of the Message object;
	// 2) If the bot's message is a reply (has SendOptions.ReplyTo),
	//       sender of the original message.
	Selective bool `json:"selective,omitempty"`

	// Placeholder will be shown in the input field when the reply is active.
	Placeholder string `json:"input_field_placeholder,omitempty"`

	// IsPersistent allows to control when the keyboard is shown.
	IsPersistent bool `json:"is_persistent,omitempty"`
}

func (r *ReplyMarkup) copy() *ReplyMarkup {
	cp := *r

	if len(r.ReplyKeyboard) > 0 {
		cp.ReplyKeyboard = make([][]ReplyButton, len(r.ReplyKeyboard))
		for i, row := range r.ReplyKeyboard {
			cp.ReplyKeyboard[i] = make([]ReplyButton, len(row))
			copy(cp.ReplyKeyboard[i], row)
		}
	}

	if len(r.InlineKeyboard) > 0 {
		cp.InlineKeyboard = make([][]InlineButton, len(r.InlineKeyboard))
		for i, row := range r.InlineKeyboard {
			cp.InlineKeyboard[i] = make([]InlineButton, len(row))
			copy(cp.InlineKeyboard[i], row)
		}
	}

	return &cp
}

// Btn is a constructor button, which will later become either a reply, or an inline button.
type Btn struct {
	Unique          string          `json:"unique,omitempty"`
	Text            string          `json:"text,omitempty"`
	URL             string          `json:"url,omitempty"`
	Data            string          `json:"callback_data,omitempty"`
	InlineQuery     string          `json:"switch_inline_query,omitempty"`
	InlineQueryChat string          `json:"switch_inline_query_current_chat,omitempty"`
	Login           *Login          `json:"login_url,omitempty"`
	WebApp          *WebApp         `json:"web_app,omitempty"`
	Contact         bool            `json:"request_contact,omitempty"`
	Location        bool            `json:"request_location,omitempty"`
	Poll            PollType        `json:"request_poll,omitempty"`
	User            *ReplyRecipient `json:"request_user,omitempty"`
	Chat            *ReplyRecipient `json:"request_chat,omitempty"`
}

// Row represents an array of buttons, a row.
type Row []Btn

// Row creates a row of buttons.
func (r *ReplyMarkup) Row(many ...Btn) Row {
	return many
}

// Split splits the keyboard into the rows with N maximum number of buttons.
// For example, if you pass six buttons and 3 as the max, you get two rows with
// three buttons in each.
//
// `Split(3, []Btn{six buttons...}) -> [[1, 2, 3], [4, 5, 6]]`
// `Split(2, []Btn{six buttons...}) -> [[1, 2],[3, 4],[5, 6]]`
func (r *ReplyMarkup) Split(max int, btns []Btn) []Row {
	rows := make([]Row, (max-1+len(btns))/max)
	for i, b := range btns {
		i /= max
		rows[i] = append(rows[i], b)
	}
	return rows
}

func (r *ReplyMarkup) Inline(rows ...Row) {
	inlineKeys := make([][]InlineButton, 0, len(rows))
	for i, row := range rows {
		keys := make([]InlineButton, 0, len(row))
		for j, btn := range row {
			btn := btn.Inline()
			if btn == nil {
				panic(fmt.Sprintf(
					"telebot: button row %d column %d is not an inline button",
					i, j))
			}
			keys = append(keys, *btn)
		}
		inlineKeys = append(inlineKeys, keys)
	}

	r.InlineKeyboard = inlineKeys
}

func (r *ReplyMarkup) Reply(rows ...Row) {
	replyKeys := make([][]ReplyButton, 0, len(rows))
	for i, row := range rows {
		keys := make([]ReplyButton, 0, len(row))
		for j, btn := range row {
			btn := btn.Reply()
			if btn == nil {
				panic(fmt.Sprintf(
					"telebot: button row %d column %d is not a reply button",
					i, j))
			}
			keys = append(keys, *btn)
		}
		replyKeys = append(replyKeys, keys)
	}

	r.ReplyKeyboard = replyKeys
}

func (r *ReplyMarkup) Text(text string) Btn {
	return Btn{Text: text}
}

func (r *ReplyMarkup) Data(text, unique string, data ...string) Btn {
	return Btn{
		Unique: unique,
		Text:   text,
		Data:   strings.Join(data, "|"),
	}
}

func (r *ReplyMarkup) URL(text, url string) Btn {
	return Btn{Text: text, URL: url}
}

func (r *ReplyMarkup) Query(text, query string) Btn {
	return Btn{Text: text, InlineQuery: query}
}

func (r *ReplyMarkup) QueryChat(text, query string) Btn {
	return Btn{Text: text, InlineQueryChat: query}
}

func (r *ReplyMarkup) Contact(text string) Btn {
	return Btn{Contact: true, Text: text}
}

func (r *ReplyMarkup) Location(text string) Btn {
	return Btn{Location: true, Text: text}
}

func (r *ReplyMarkup) Poll(text string, poll PollType) Btn {
	return Btn{Poll: poll, Text: text}
}

func (r *ReplyMarkup) User(text string, user *ReplyRecipient) Btn {
	return Btn{Text: text, User: user}
}

func (r *ReplyMarkup) Chat(text string, chat *ReplyRecipient) Btn {
	return Btn{Text: text, Chat: chat}
}

func (r *ReplyMarkup) Login(text string, login *Login) Btn {
	return Btn{Login: login, Text: text}
}

func (r *ReplyMarkup) WebApp(text string, app *WebApp) Btn {
	return Btn{Text: text, WebApp: app}
}

// ReplyButton represents a button displayed in reply-keyboard.
//
// Set either Contact or Location to true in order to request
// sensitive info, such as user's phone number or current location.
type ReplyButton struct {
	Text string `json:"text"`

	Contact  bool            `json:"request_contact,omitempty"`
	Location bool            `json:"request_location,omitempty"`
	Poll     PollType        `json:"request_poll,omitempty"`
	User     *ReplyRecipient `json:"request_user,omitempty"`
	Chat     *ReplyRecipient `json:"request_chat,omitempty"`
	WebApp   *WebApp         `json:"web_app,omitempty"`
}

// MarshalJSON implements json.Marshaler. It allows passing PollType as a
// keyboard's poll type instead of KeyboardButtonPollType object.
func (pt PollType) MarshalJSON() ([]byte, error) {
	return json.Marshal(&struct {
		Type string `json:"type"`
	}{
		Type: string(pt),
	})
}

// ReplyRecipient combines both KeyboardButtonRequestUser
// and KeyboardButtonRequestChat objects. Use inside ReplyButton
// to request the user or chat sharing with respective settings.
//
// To pass the pointers to bool use a special tele.Flag function,
// that way you will be able to reflect the three-state bool (nil, false, true).
type ReplyRecipient struct {
	ID int32 `json:"request_id"`

	Bot     *bool `json:"user_is_bot,omitempty"`     // user only, optional
	Premium *bool `json:"user_is_premium,omitempty"` // user only, optional

	Channel      bool    `json:"chat_is_channel,omitempty"`           // chat only, required
	Forum        *bool   `json:"chat_is_forum,omitempty"`             // chat only, optional
	WithUsername *bool   `json:"chat_has_username,omitempty"`         // chat only, optional
	Created      *bool   `json:"chat_is_created,omitempty"`           // chat only, optional
	UserRights   *Rights `json:"user_administrator_rights,omitempty"` // chat only, optional
	BotRights    *Rights `json:"bot_administrator_rights,omitempty"`  // chat only, optional
	BotMember    *bool   `json:"bot_is_member,omitempty"`             // chat only, optional
}

// RecipientShared combines both UserShared and ChatShared objects.
type RecipientShared struct {
	ID     int32 `json:"request_id"`
	UserID int64 `json:"user_id"`
	ChatID int64 `json:"chat_id"`
}

// InlineButton represents a button displayed in the message.
type InlineButton struct {
	// Unique slagish name for this kind of button,
	// try to be as specific as possible.
	//
	// It will be used as a callback endpoint.
	Unique string `json:"unique,omitempty"`

	Text            string  `json:"text"`
	URL             string  `json:"url,omitempty"`
	Data            string  `json:"callback_data,omitempty"`
	InlineQuery     string  `json:"switch_inline_query,omitempty"`
	InlineQueryChat string  `json:"switch_inline_query_current_chat"`
	Login           *Login  `json:"login_url,omitempty"`
	WebApp          *WebApp `json:"web_app,omitempty"`
}

// MarshalJSON implements json.Marshaler interface.
// It needed to avoid InlineQueryChat and Login or WebApp fields conflict.
// If you have Login or WebApp field in your button, InlineQueryChat must be skipped.
func (t *InlineButton) MarshalJSON() ([]byte, error) {
	type IB InlineButton

	if t.Login != nil || t.WebApp != nil {
		return json.Marshal(struct {
			IB
			InlineQueryChat string `json:"switch_inline_query_current_chat,omitempty"`
		}{
			IB: IB(*t),
		})
	}
	return json.Marshal(IB(*t))
}

// With returns a copy of the button with data.
func (t *InlineButton) With(data string) *InlineButton {
	return &InlineButton{
		Unique:          t.Unique,
		Text:            t.Text,
		URL:             t.URL,
		InlineQuery:     t.InlineQuery,
		InlineQueryChat: t.InlineQueryChat,
		Login:           t.Login,
		Data:            data,
	}
}

func (b Btn) Reply() *ReplyButton {
	if b.Unique != "" {
		return nil
	}

	return &ReplyButton{
		Text:     b.Text,
		Contact:  b.Contact,
		Location: b.Location,
		Poll:     b.Poll,
		User:     b.User,
		Chat:     b.Chat,
		WebApp:   b.WebApp,
	}
}

func (b Btn) Inline() *InlineButton {
	return &InlineButton{
		Unique:          b.Unique,
		Text:            b.Text,
		URL:             b.URL,
		Data:            b.Data,
		InlineQuery:     b.InlineQuery,
		InlineQueryChat: b.InlineQueryChat,
		Login:           b.Login,
		WebApp:          b.WebApp,
	}
}

// Login represents a parameter of the inline keyboard button
// used to automatically authorize a user. Serves as a great replacement
// for the Telegram Login Widget when the user is coming from Telegram.
type Login struct {
	URL         string `json:"url"`
	Text        string `json:"forward_text,omitempty"`
	Username    string `json:"bot_username,omitempty"`
	WriteAccess bool   `json:"request_write_access,omitempty"`
}

// MenuButton describes the bot's menu button in a private chat.
type MenuButton struct {
	Type   MenuButtonType `json:"type"`
	Text   string         `json:"text,omitempty"`
	WebApp *WebApp        `json:"web_app,omitempty"`
}

type MenuButtonType = string

const (
	MenuButtonDefault  MenuButtonType = "default"
	MenuButtonCommands MenuButtonType = "commands"
	MenuButtonWebApp   MenuButtonType = "web_app"
)
