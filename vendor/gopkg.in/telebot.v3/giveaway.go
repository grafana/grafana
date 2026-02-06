package telebot

import "time"

// Giveaway represents a message about a scheduled giveaway.
type Giveaway struct {
	// The list of chats which the user must join to participate in the giveaway.
	Chats []Chat `json:"chats"`

	// Point in time (Unix timestamp) when winners of the giveaway will be selected.
	SelectionUnixtime int64 `json:"winners_selection_date"`

	// The number of users which are supposed to be selected as winners of the giveaway.
	WinnerCount int `json:"winner_count"`

	// (Optional) True, if only users who join the chats after the giveaway
	// started should be eligible to win.
	OnlyNewMembers bool `json:"only_new_members"`

	// (Optional) True, if the list of giveaway winners will be visible to everyone.
	HasPublicWinners bool `json:"has_public_winners"`

	// (Optional) Description of additional giveaway prize.
	PrizeDescription string `json:"prize_description"`

	// (Optional) A list of two-letter ISO 3166-1 alpha-2 country codes indicating
	// the countries from which eligible users for the giveaway must come.
	// If empty, then all users can participate in the giveaway. Users with a phone number
	// that was bought on Fragment can always participate in giveaways.
	CountryCodes []string `json:"country_codes"`

	// (Optional) The number of months the Telegram Premium subscription won from
	// the giveaway will be active for.
	PremiumMonthCount int `json:"premium_subscription_month_count"`
}

// SelectionDate returns the moment of when winners of the giveaway were selected in local time.
func (g *Giveaway) SelectionDate() time.Time {
	return time.Unix(g.SelectionUnixtime, 0)
}

// GiveawayWinners object represents a message about the completion of a
// giveaway with public winners.
type GiveawayWinners struct {
	// The chat that created the giveaway.
	Chat *Chat `json:"chat"`

	// Identifier of the message with the giveaway in the chat.
	MessageID int `json:"message_id"`

	// Point in time (Unix timestamp) when winners of the giveaway were selected.
	SelectionUnixtime int64 `json:"winners_selection_date"`

	// The number of users which are supposed to be selected as winners of the giveaway.
	WinnerCount int `json:"winner_count"`

	// List of up to 100 winners of the giveaway.
	Winners []User `json:"winners"`

	// (Optional) The number of other chats the user had to join in order
	// to be eligible for the giveaway.
	AdditionalChats int `json:"additional_chat_count"`

	// (Optional) The number of months the Telegram Premium subscription won from
	// the giveaway will be active for.
	PremiumMonthCount int `json:"premium_subscription_month_count"`

	// (Optional) Number of undistributed prizes.
	UnclaimedPrizes int `json:"unclaimed_prize_count"`

	// (Optional) True, if only users who had joined the chats after the giveaway started
	// were eligible to win.
	OnlyNewMembers bool `json:"only_new_members"`

	// (Optional) True, if the giveaway was canceled because the payment for it was refunded.
	Refunded bool `json:"was_refunded"`

	// (Optional) Description of additional giveaway prize.
	PrizeDescription string `json:"prize_description"`
}

// SelectionDate returns the moment of when winners of the giveaway
// were selected in local time.
func (g *GiveawayWinners) SelectionDate() time.Time {
	return time.Unix(g.SelectionUnixtime, 0)
}

// GiveawayCreated represents a service message about the creation of a scheduled giveaway.
// Currently holds no information.
type GiveawayCreated struct{}

// GiveawayCompleted represents a service message about the completion of a
// giveaway without public winners.
type GiveawayCompleted struct {
	// Number of winners in the giveaway.
	WinnerCount int `json:"winner_count"`

	// (Optional) Number of undistributed prizes.
	UnclaimedPrizes int `json:"unclaimed_prize_count"`

	// (Optional) Message with the giveaway that was completed, if it wasn't deleted.
	Message *Message `json:"giveaway_message"`
}
