package telebot

import (
	"encoding/json"
	"time"
)

// Boost contains information about a chat boost.
type Boost struct {
	// Unique identifier of the boost.
	ID string `json:"boost_id"`

	// Point in time (Unix timestamp) when the chat was boosted.
	AddUnixtime int64 `json:"add_date"`

	// Point in time (Unix timestamp) when the boost will automatically expire,
	// unless the booster's Telegram Premium subscription is prolonged.
	ExpirationUnixtime int64 `json:"expiration_date"`

	// Source of the added boost.
	Source *BoostSource `json:"source"`
}

// AddDate returns the moment of time when the chat has been boosted in local time.
func (c *Boost) AddDate() time.Time {
	return time.Unix(c.AddUnixtime, 0)
}

// ExpirationDate returns the moment of time when the boost of the channel
// will expire in local time.
func (c *Boost) ExpirationDate() time.Time {
	return time.Unix(c.ExpirationUnixtime, 0)
}

// BoostSourceType describes a type of boost.
type BoostSourceType = string

const (
	BoostPremium  BoostSourceType = "premium"
	BoostGiftCode BoostSourceType = "gift_code"
	BoostGiveaway BoostSourceType = "giveaway"
)

// BoostSource describes the source of a chat boost.
type BoostSource struct {
	// Source of the boost, always (“premium”, “gift_code”, “giveaway”).
	Source BoostSourceType `json:"source"`

	// User that boosted the chat.
	Booster *User `json:"user"`

	// Identifier of a message in the chat with the giveaway; the message
	// could have been deleted already. May be 0 if the message isn't sent yet.
	GiveawayMessageID int `json:"giveaway_message_id,omitempty"`

	// (Optional) True, if the giveaway was completed, but there was
	// no user to win the prize.
	Unclaimed bool `json:"is_unclaimed,omitempty"`
}

// BoostAdded represents a service message about a user boosting a chat.
type BoostAdded struct {
	// Number of boosts added by the user.
	Count int `json:"boost_count"`
}

// BoostUpdated represents a boost added to a chat or changed.
type BoostUpdated struct {
	// Chat which was boosted.
	Chat *Chat `json:"chat"`

	// Information about the chat boost.
	Boost *Boost `json:"boost"`
}

// BoostRemoved represents a boost removed from a chat.
type BoostRemoved struct {
	// Chat which was boosted.
	Chat *Chat `json:"chat"`

	// Unique identifier of the boost.
	BoostID string `json:"boost_id"`

	// Point in time (Unix timestamp) when the boost was removed.
	RemoveUnixtime int64 `json:"remove_date"`

	// Source of the removed boost.
	Source *BoostSource `json:"source"`
}

// UserBoosts gets the list of boosts added to a chat by a user.
// Requires administrator rights in the chat.
func (b *Bot) UserBoosts(chat, user Recipient) ([]Boost, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
		"user_id": user.Recipient(),
	}

	data, err := b.Raw("getUserChatBoosts", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result struct {
			Boosts []Boost `json:"boosts"`
		}
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result.Boosts, nil
}
