package telebot

import (
	"encoding/json"
	"strconv"
)

// Game object represents a game.
// Their short names acts as unique identifiers.
type Game struct {
	Name string `json:"game_short_name"`

	Title       string `json:"title"`
	Description string `json:"description"`
	Photo       *Photo `json:"photo"`

	// (Optional)
	Text      string          `json:"text"`
	Entities  []MessageEntity `json:"text_entities"`
	Animation *Animation      `json:"animation"`
}

// GameHighScore object represents one row
// of the high scores table for a game.
type GameHighScore struct {
	User     *User `json:"user"`
	Position int   `json:"position"`

	Score  int  `json:"score"`
	Force  bool `json:"force"`
	NoEdit bool `json:"disable_edit_message"`
}

// GameScores returns the score of the specified user
// and several of their neighbors in a game.
//
// This function will panic upon nil Editable.
//
// Currently, it returns scores for the target user,
// plus two of their closest neighbors on each side.
// Will also return the top three users
// if the user and his neighbors are not among them.
//
func (b *Bot) GameScores(user Recipient, msg Editable) ([]GameHighScore, error) {
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"user_id": user.Recipient(),
	}

	if chatID == 0 { // if inline message
		params["inline_message_id"] = msgID
	} else {
		params["chat_id"] = strconv.FormatInt(chatID, 10)
		params["message_id"] = msgID
	}

	data, err := b.Raw("getGameHighScores", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result []GameHighScore
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	return resp.Result, nil
}

// SetGameScore sets the score of the specified user in a game.
//
// If the message was sent by the bot, returns the edited Message,
// otherwise returns nil and ErrTrueResult.
//
func (b *Bot) SetGameScore(user Recipient, msg Editable, score GameHighScore) (*Message, error) {
	msgID, chatID := msg.MessageSig()

	params := map[string]string{
		"user_id":              user.Recipient(),
		"score":                strconv.Itoa(score.Score),
		"force":                strconv.FormatBool(score.Force),
		"disable_edit_message": strconv.FormatBool(score.NoEdit),
	}

	if chatID == 0 { // if inline message
		params["inline_message_id"] = msgID
	} else {
		params["chat_id"] = strconv.FormatInt(chatID, 10)
		params["message_id"] = msgID
	}

	data, err := b.Raw("setGameScore", params)
	if err != nil {
		return nil, err
	}
	return extractMessage(data)
}
