package telebot

import "time"

// PollType defines poll types.
type PollType string

const (
	// NOTE:
	// Despite "any" type isn't described in documentation,
	// it needed for proper KeyboardButtonPollType marshaling.
	PollAny PollType = "any"

	PollQuiz    PollType = "quiz"
	PollRegular PollType = "regular"
)

// Poll contains information about a poll.
type Poll struct {
	ID         string       `json:"id"`
	Type       PollType     `json:"type"`
	Question   string       `json:"question"`
	Options    []PollOption `json:"options"`
	VoterCount int          `json:"total_voter_count"`

	// (Optional)
	Closed          bool            `json:"is_closed,omitempty"`
	CorrectOption   int             `json:"correct_option_id,omitempty"`
	MultipleAnswers bool            `json:"allows_multiple_answers,omitempty"`
	Explanation     string          `json:"explanation,omitempty"`
	ParseMode       ParseMode       `json:"explanation_parse_mode,omitempty"`
	Entities        []MessageEntity `json:"explanation_entities"`

	// True by default, shouldn't be omitted.
	Anonymous bool `json:"is_anonymous"`

	// (Mutually exclusive)
	OpenPeriod    int   `json:"open_period,omitempty"`
	CloseUnixdate int64 `json:"close_date,omitempty"`
}

// PollOption contains information about one answer option in a poll.
type PollOption struct {
	Text       string `json:"text"`
	VoterCount int    `json:"voter_count"`
}

// PollAnswer represents an answer of a user in a non-anonymous poll.
type PollAnswer struct {
	PollID  string `json:"poll_id"`
	Sender  *User  `json:"user"`
	Chat    *Chat  `json:"voter_chat"`
	Options []int  `json:"option_ids"`
}

// IsRegular says whether poll is a regular.
func (p *Poll) IsRegular() bool {
	return p.Type == PollRegular
}

// IsQuiz says whether poll is a quiz.
func (p *Poll) IsQuiz() bool {
	return p.Type == PollQuiz
}

// CloseDate returns the close date of poll in local time.
func (p *Poll) CloseDate() time.Time {
	return time.Unix(p.CloseUnixdate, 0)
}

// AddOptions adds text options to the poll.
func (p *Poll) AddOptions(opts ...string) {
	for _, t := range opts {
		p.Options = append(p.Options, PollOption{Text: t})
	}
}
