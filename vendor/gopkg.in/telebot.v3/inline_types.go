package telebot

// ResultBase must be embedded into all IQRs.
type ResultBase struct {
	// Unique identifier for this result, 1-64 Bytes.
	// If left unspecified, a 64-bit FNV-1 hash will be calculated
	ID string `json:"id"`

	// Ignore. This field gets set automatically.
	Type string `json:"type"`

	// Optional. Send Markdown or HTML, if you want Telegram apps to show
	// bold, italic, fixed-width text or inline URLs in the media caption.
	ParseMode ParseMode `json:"parse_mode,omitempty"`

	// Optional. Content of the message to be sent.
	Content InputMessageContent `json:"input_message_content,omitempty"`

	// Optional. Inline keyboard attached to the message.
	ReplyMarkup *ReplyMarkup `json:"reply_markup,omitempty"`
}

// ResultID returns ResultBase.ID.
func (r *ResultBase) ResultID() string {
	return r.ID
}

// SetResultID sets ResultBase.ID.
func (r *ResultBase) SetResultID(id string) {
	r.ID = id
}

// SetParseMode sets ResultBase.ParseMode.
func (r *ResultBase) SetParseMode(mode ParseMode) {
	r.ParseMode = mode
}

// SetContent sets ResultBase.Content.
func (r *ResultBase) SetContent(content InputMessageContent) {
	r.Content = content
}

// SetReplyMarkup sets ResultBase.ReplyMarkup.
func (r *ResultBase) SetReplyMarkup(markup *ReplyMarkup) {
	r.ReplyMarkup = markup
}

func (r *ResultBase) Process(b *Bot) {
	if r.ParseMode == ModeDefault {
		r.ParseMode = b.parseMode
	}
	if r.Content != nil {
		c, ok := r.Content.(*InputTextMessageContent)
		if ok && c.ParseMode == ModeDefault {
			c.ParseMode = r.ParseMode
		}
	}
	if r.ReplyMarkup != nil {
		processButtons(r.ReplyMarkup.InlineKeyboard)
	}
}

// GameResult represents a game. Game is a content type
// supported by Telegram, which can be sent back to the
// user as a result for an inline query.
type GameResult struct {
	ResultBase

	// ShortName is a unique identifier of the game.
	ShortName string `json:"game_short_name"`
}

// ArticleResult represents a link to an article or web page.
type ArticleResult struct {
	ResultBase

	// Title of the result.
	Title string `json:"title"`

	// Message text. Shortcut (and mutually exclusive to) specifying
	// InputMessageContent.
	Text string `json:"message_text,omitempty"`

	// Optional. URL of the result.
	URL string `json:"url,omitempty"`

	// Optional. Pass True, if you don't want the URL to be shown in the message.
	HideURL bool `json:"hide_url,omitempty"`

	// Optional. Short description of the result.
	Description string `json:"description,omitempty"`

	// Optional. URL of the thumbnail for the result.
	ThumbURL string `json:"thumbnail_url,omitempty"`

	// Optional. Width of the thumbnail for the result.
	ThumbWidth int `json:"thumbnail_width,omitempty"`

	// Optional. Height of the thumbnail for the result.
	ThumbHeight int `json:"thumbnail_height,omitempty"`
}

// AudioResult represents a link to an mp3 audio file.
type AudioResult struct {
	ResultBase

	// Title.
	Title string `json:"title"`

	// A valid URL for the audio file.
	URL string `json:"audio_url"`

	// Optional. Performer.
	Performer string `json:"performer,omitempty"`

	// Optional. Audio duration in seconds.
	Duration int `json:"audio_duration,omitempty"`

	// Optional. Caption, 0-1024 characters.
	Caption string `json:"caption,omitempty"`

	// If Cache != "", it'll be used instead
	Cache string `json:"audio_file_id,omitempty"`
}

// ContactResult represents a contact with a phone number.
type ContactResult struct {
	ResultBase

	// Contact's phone number.
	PhoneNumber string `json:"phone_number"`

	// Optional. Additional data about the contact in the form of a vCard, 0-2048 bytes.
	VCard string `json:"vcard,omitempty"`

	// Contact's first name.
	FirstName string `json:"first_name"`

	// Optional. Contact's last name.
	LastName string `json:"last_name,omitempty"`

	// Optional. URL of the thumbnail for the result.
	ThumbURL string `json:"thumbnail_url,omitempty"`

	// Optional. Width of the thumbnail for the result.
	ThumbWidth int `json:"thumbnail_width,omitempty"`

	// Optional. Height of the thumbnail for the result.
	ThumbHeight int `json:"thumbnail_height,omitempty"`
}

// DocumentResult represents a link to a file.
type DocumentResult struct {
	ResultBase

	// Title for the result.
	Title string `json:"title"`

	// A valid URL for the file
	URL string `json:"document_url"`

	// Mime type of the content of the file, either “application/pdf” or
	// “application/zip”.
	MIME string `json:"mime_type"`

	// Optional. Caption of the document to be sent, 0-200 characters.
	Caption string `json:"caption,omitempty"`

	// Optional. Short description of the result.
	Description string `json:"description,omitempty"`

	// Optional. URL of the thumbnail (jpeg only) for the file.
	ThumbURL string `json:"thumbnail_url,omitempty"`

	// Optional. Width of the thumbnail for the result.
	ThumbWidth int `json:"thumbnail_width,omitempty"`

	// Optional. Height of the thumbnail for the result.
	ThumbHeight int `json:"thumbnail_height,omitempty"`

	// If Cache != "", it'll be used instead
	Cache string `json:"document_file_id,omitempty"`
}

// GifResult represents a link to an animated GIF file.
type GifResult struct {
	ResultBase

	// A valid URL for the GIF file. File size must not exceed 1MB.
	URL string `json:"gif_url"`

	// Optional. Width of the GIF.
	Width int `json:"gif_width,omitempty"`

	// Optional. Height of the GIF.
	Height int `json:"gif_height,omitempty"`

	// Optional. Duration of the GIF.
	Duration int `json:"gif_duration,omitempty"`

	// URL of the static thumbnail for the result (jpeg or gif).
	ThumbURL string `json:"thumbnail_url"`

	// Optional. MIME type of the thumbnail, must be one of
	// “image/jpeg”, “image/gif”, or “video/mp4”.
	ThumbMIME string `json:"thumbnail_mime_type,omitempty"`

	// Optional. Title for the result.
	Title string `json:"title,omitempty"`

	// Optional. Caption of the GIF file to be sent, 0-200 characters.
	Caption string `json:"caption,omitempty"`

	// If Cache != "", it'll be used instead
	Cache string `json:"gif_file_id,omitempty"`
}

// LocationResult represents a location on a map.
type LocationResult struct {
	ResultBase

	Location

	// Location title.
	Title string `json:"title"`

	// Optional. Url of the thumbnail for the result.
	ThumbURL string `json:"thumbnail_url,omitempty"`
}

// Mpeg4GifResult represents a link to a video animation
// (H.264/MPEG-4 AVC video without sound).
type Mpeg4GifResult struct {
	ResultBase

	// A valid URL for the MP4 file.
	URL string `json:"mpeg4_url"`

	// Optional. Video width.
	Width int `json:"mpeg4_width,omitempty"`

	// Optional. Video height.
	Height int `json:"mpeg4_height,omitempty"`

	// Optional. Video duration.
	Duration int `json:"mpeg4_duration,omitempty"`

	// URL of the static thumbnail (jpeg or gif) for the result.
	ThumbURL string `json:"thumbnail_url,omitempty"`

	// Optional. MIME type of the thumbnail, must be one of
	// “image/jpeg”, “image/gif”, or “video/mp4”.
	ThumbMIME string `json:"thumbnail_mime_type,omitempty"`

	// Optional. Title for the result.
	Title string `json:"title,omitempty"`

	// Optional. Caption of the MPEG-4 file to be sent, 0-200 characters.
	Caption string `json:"caption,omitempty"`

	// If Cache != "", it'll be used instead
	Cache string `json:"mpeg4_file_id,omitempty"`
}

// PhotoResult represents a link to a photo.
type PhotoResult struct {
	ResultBase

	// A valid URL of the photo. Photo must be in jpeg format.
	// Photo size must not exceed 5MB.
	URL string `json:"photo_url"`

	// Optional. Width of the photo.
	Width int `json:"photo_width,omitempty"`

	// Optional. Height of the photo.
	Height int `json:"photo_height,omitempty"`

	// Optional. Title for the result.
	Title string `json:"title,omitempty"`

	// Optional. Short description of the result.
	Description string `json:"description,omitempty"`

	// Optional. Caption of the photo to be sent, 0-200 characters.
	Caption string `json:"caption,omitempty"`

	// URL of the thumbnail for the photo.
	ThumbURL string `json:"thumbnail_url"`

	// If Cache != "", it'll be used instead
	Cache string `json:"photo_file_id,omitempty"`
}

// VenueResult represents a venue.
type VenueResult struct {
	ResultBase

	Location

	// Title of the venue.
	Title string `json:"title"`

	// Address of the venue.
	Address string `json:"address"`

	// Optional. Foursquare identifier of the venue if known.
	FoursquareID string `json:"foursquare_id,omitempty"`

	// Optional. URL of the thumbnail for the result.
	ThumbURL string `json:"thumbnail_url,omitempty"`

	// Optional. Width of the thumbnail for the result.
	ThumbWidth int `json:"thumbnail_width,omitempty"`

	// Optional. Height of the thumbnail for the result.
	ThumbHeight int `json:"thumbnail_height,omitempty"`
}

// VideoResult represents a link to a page containing an embedded
// video player or a video file.
type VideoResult struct {
	ResultBase

	// A valid URL for the embedded video player or video file.
	URL string `json:"video_url"`

	// Mime type of the content of video url, “text/html” or “video/mp4”.
	MIME string `json:"mime_type"`

	// URL of the thumbnail (jpeg only) for the video.
	ThumbURL string `json:"thumbnail_url"`

	// Title for the result.
	Title string `json:"title"`

	// Optional. Caption of the video to be sent, 0-200 characters.
	Caption string `json:"caption,omitempty"`

	// Optional. Video width.
	Width int `json:"video_width,omitempty"`

	// Optional. Video height.
	Height int `json:"video_height,omitempty"`

	// Optional. Video duration in seconds.
	Duration int `json:"video_duration,omitempty"`

	// Optional. Short description of the result.
	Description string `json:"description,omitempty"`

	// If Cache != "", it'll be used instead
	Cache string `json:"video_file_id,omitempty"`
}

// VoiceResult represents a link to a voice recording in an .ogg
// container encoded with OPUS.
type VoiceResult struct {
	ResultBase

	// A valid URL for the voice recording.
	URL string `json:"voice_url"`

	// Recording title.
	Title string `json:"title"`

	// Optional. Recording duration in seconds.
	Duration int `json:"voice_duration"`

	// Optional. Caption, 0-1024 characters.
	Caption string `json:"caption,omitempty"`

	// If Cache != "", it'll be used instead
	Cache string `json:"voice_file_id,omitempty"`
}

// StickerResult represents an inline cached sticker response.
type StickerResult struct {
	ResultBase

	// If Cache != "", it'll be used instead
	Cache string `json:"sticker_file_id,omitempty"`
}
