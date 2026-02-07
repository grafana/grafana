package telebot

// InputMessageContent objects represent the content of a message to be sent
// as a result of an inline query.
type InputMessageContent interface {
	IsInputMessageContent() bool
}

// InputTextMessageContent represents the content of a text message to be
// sent as the result of an inline query.
type InputTextMessageContent struct {
	// Text of the message to be sent, 1-4096 characters.
	Text string `json:"message_text"`

	// (Optional) Send Markdown or HTML, if you want Telegram apps to show
	// bold, italic, fixed-width text or inline URLs in your bot's message.
	ParseMode string `json:"parse_mode,omitempty"`

	// (Optional) Link preview generation options for the message.
	PreviewOptions *PreviewOptions `json:"link_preview_options,omitempty"`
}

func (input *InputTextMessageContent) IsInputMessageContent() bool {
	return true
}

// InputLocationMessageContent represents the content of a location message
// to be sent as the result of an inline query.
type InputLocationMessageContent struct {
	Lat float32 `json:"latitude"`
	Lng float32 `json:"longitude"`
}

func (input *InputLocationMessageContent) IsInputMessageContent() bool {
	return true
}

// InputVenueMessageContent represents the content of a venue message to
// be sent as the result of an inline query.
type InputVenueMessageContent struct {
	Lat float32 `json:"latitude"`
	Lng float32 `json:"longitude"`

	// Name of the venue.
	Title string `json:"title"`

	// Address of the venue.
	Address string `json:"address"`

	// Optional. Foursquare identifier of the venue, if known.
	FoursquareID string `json:"foursquare_id,omitempty"`
}

func (input *InputVenueMessageContent) IsInputMessageContent() bool {
	return true
}

// InputContactMessageContent represents the content of a contact
// message to be sent as the result of an inline query.
type InputContactMessageContent struct {
	// Contact's phone number.
	PhoneNumber string `json:"phone_number"`

	// Contact's first name.
	FirstName string `json:"first_name"`

	// Optional. Contact's last name.
	LastName string `json:"last_name,omitempty"`
}

func (input *InputContactMessageContent) IsInputMessageContent() bool {
	return true
}
