package telebot

import (
	"encoding/json"
	"fmt"
)

// Query is an incoming inline query. When the user sends
// an empty query, your bot could return some default or
// trending results.
type Query struct {
	// Unique identifier for this query. 1-64 bytes.
	ID string `json:"id"`

	// Sender.
	Sender *User `json:"from"`

	// Sender location, only for bots that request user location.
	Location *Location `json:"location"`

	// Text of the query (up to 512 characters).
	Text string `json:"query"`

	// Offset of the results to be returned, can be controlled by the bot.
	Offset string `json:"offset"`

	// ChatType of the type of the chat, from which the inline query was sent.
	ChatType string `json:"chat_type"`
}

// QueryResponse builds a response to an inline Query.
type QueryResponse struct {
	// The ID of the query to which this is a response.
	//
	// Note: Telebot sets this field automatically!
	QueryID string `json:"inline_query_id"`

	// The results for the inline query.
	Results Results `json:"results"`

	// (Optional) The maximum amount of time in seconds that the result
	// of the inline query may be cached on the server.
	CacheTime int `json:"cache_time,omitempty"`

	// (Optional) Pass True, if results may be cached on the server side
	// only for the user that sent the query. By default, results may
	// be returned to any user who sends the same query.
	IsPersonal bool `json:"is_personal"`

	// (Optional) Pass the offset that a client should send in the next
	// query with the same text to receive more results. Pass an empty
	// string if there are no more results or if you don‘t support
	// pagination. Offset length can’t exceed 64 bytes.
	NextOffset string `json:"next_offset"`

	// (Optional) If passed, clients will display a button with specified
	// text that switches the user to a private chat with the bot and sends
	// the bot a start message with the parameter switch_pm_parameter.
	SwitchPMText string `json:"switch_pm_text,omitempty"`

	// (Optional) Parameter for the start message sent to the bot when user
	// presses the switch button.
	SwitchPMParameter string `json:"switch_pm_parameter,omitempty"`

	// (Optional) A JSON-serialized object describing a button to be shown
	// above inline query results.
	Button *QueryResponseButton `json:"button,omitempty"`
}

// QueryResponseButton represents a button to be shown above inline query results.
// You must use exactly one of the optional fields.
type QueryResponseButton struct {
	// Label text on the button
	Text string `json:"text"`

	// (Optional) Description of the Web App that will be launched when the
	// user presses the button. The Web App will be able to switch back to the
	// inline mode using the method switchInlineQuery inside the Web App.
	WebApp *WebApp `json:"web_app"`

	// (Optional) Deep-linking parameter for the /start message sent to the bot
	// when a user presses the button. 1-64 characters, only A-Z, a-z, 0-9, _ and - are allowed.
	Start string `json:"start_parameter"`
}

// SwitchInlineQuery represents an inline button that switches the current
// user to inline mode in a chosen chat, with an optional default inline query.
type SwitchInlineQuery struct {
	// (Optional) The default inline query to be inserted in the input field.
	// If left empty, only the bot's username will be inserted.
	Query string `json:"query"`

	// (Optional) True, if private chats with users can be chosen.
	AllowUserChats bool `json:"allow_user_chats"`

	// (Optional) True, if private chats with bots can be chosen.
	AllowBotChats bool `json:"allow_bot_chats"`

	// (Optional) True, if group and supergroup chats can be chosen.
	AllowGroupChats bool `json:"allow_group_chats"`

	// (Optional) True, if channel chats can be chosen.
	AllowChannelChats bool `json:"allow_channel_chats"`
}

// InlineResult represents a result of an inline query that was chosen
// by the user and sent to their chat partner.
type InlineResult struct {
	Sender    *User     `json:"from"`
	Location  *Location `json:"location,omitempty"`
	ResultID  string    `json:"result_id"`
	Query     string    `json:"query"`
	MessageID string    `json:"inline_message_id"` // inline messages only!
}

// MessageSig satisfies Editable interface.
func (ir *InlineResult) MessageSig() (string, int64) {
	return ir.MessageID, 0
}

// Result represents one result of an inline query.
type Result interface {
	ResultID() string
	SetResultID(string)
	SetParseMode(ParseMode)
	SetContent(InputMessageContent)
	SetReplyMarkup(*ReplyMarkup)
	Process(*Bot)
}

// Results is a slice wrapper for convenient marshalling.
type Results []Result

// MarshalJSON makes sure IQRs have proper IDs and Type variables set.
func (results Results) MarshalJSON() ([]byte, error) {
	for i, result := range results {
		if result.ResultID() == "" {
			result.SetResultID(fmt.Sprintf("%d", &results[i]))
		}
		if err := inferIQR(result); err != nil {
			return nil, err
		}
	}

	return json.Marshal([]Result(results))
}

func inferIQR(result Result) error {
	switch r := result.(type) {
	case *ArticleResult:
		r.Type = "article"
	case *AudioResult:
		r.Type = "audio"
	case *ContactResult:
		r.Type = "contact"
	case *DocumentResult:
		r.Type = "document"
	case *GifResult:
		r.Type = "gif"
	case *LocationResult:
		r.Type = "location"
	case *Mpeg4GifResult:
		r.Type = "mpeg4_gif"
	case *PhotoResult:
		r.Type = "photo"
	case *VenueResult:
		r.Type = "venue"
	case *VideoResult:
		r.Type = "video"
	case *VoiceResult:
		r.Type = "voice"
	case *StickerResult:
		r.Type = "sticker"
	case *GameResult:
		r.Type = "game"
	default:
		return fmt.Errorf("telebot: result %v is not supported", result)
	}

	return nil
}
