package telebot

import (
	"encoding/json"
)

// Media is a generic type for all kinds of media that includes File.
type Media interface {
	// MediaType returns string-represented media type.
	MediaType() string

	// MediaFile returns a pointer to the media file.
	MediaFile() *File
}

// InputMedia represents a composite InputMedia struct that is
// used by Telebot in sending and editing media methods.
type InputMedia struct {
	Type                 string   `json:"type"`
	Media                string   `json:"media"`
	Caption              string   `json:"caption"`
	Thumbnail            string   `json:"thumbnail,omitempty"`
	ParseMode            string   `json:"parse_mode,omitempty"`
	Entities             Entities `json:"caption_entities,omitempty"`
	Width                int      `json:"width,omitempty"`
	Height               int      `json:"height,omitempty"`
	Duration             int      `json:"duration,omitempty"`
	Title                string   `json:"title,omitempty"`
	Performer            string   `json:"performer,omitempty"`
	Streaming            bool     `json:"supports_streaming,omitempty"`
	DisableTypeDetection bool     `json:"disable_content_type_detection,omitempty"`
	HasSpoiler           bool     `json:"is_spoiler,omitempty"`
}

// Inputtable is a generic type for all kinds of media you
// can put into an album.
type Inputtable interface {
	Media

	// InputMedia returns already marshalled InputMedia type
	// ready to be used in sending and editing media methods.
	InputMedia() InputMedia
}

// Album lets you group multiple media into a single message.
type Album []Inputtable

func (a Album) SetCaption(caption string) {
	if len(a) < 1 {
		return
	}
	switch a[0].MediaType() {
	case "audio":
		a[0].(*Audio).Caption = caption
	case "video":
		a[0].(*Video).Caption = caption
	case "document":
		a[0].(*Document).Caption = caption
	case "photo":
		a[0].(*Photo).Caption = caption
	case "animation":
		a[0].(*Animation).Caption = caption
	}
}

// Photo object represents a single photo file.
type Photo struct {
	File

	Width   int    `json:"width"`
	Height  int    `json:"height"`
	Caption string `json:"caption,omitempty"`
}

type photoSize struct {
	File

	Width   int    `json:"width"`
	Height  int    `json:"height"`
	Caption string `json:"caption,omitempty"`
}

func (p *Photo) MediaType() string {
	return "photo"
}

func (p *Photo) MediaFile() *File {
	return &p.File
}

func (p *Photo) InputMedia() InputMedia {
	return InputMedia{
		Type:    p.MediaType(),
		Caption: p.Caption,
	}
}

// UnmarshalJSON is custom unmarshaller required to abstract
// away the hassle of treating different thumbnail sizes.
// Instead, Telebot chooses the hi-res one and just sticks to it.
//
// I really do find it a beautiful solution.
func (p *Photo) UnmarshalJSON(data []byte) error {
	var hq photoSize

	if data[0] == '{' {
		if err := json.Unmarshal(data, &hq); err != nil {
			return err
		}
	} else {
		var sizes []photoSize
		if err := json.Unmarshal(data, &sizes); err != nil {
			return err
		}

		hq = sizes[len(sizes)-1]
	}

	p.File = hq.File
	p.Width = hq.Width
	p.Height = hq.Height

	return nil
}

// Audio object represents an audio file.
type Audio struct {
	File

	Duration int `json:"duration,omitempty"`

	// (Optional)
	Caption   string `json:"caption,omitempty"`
	Thumbnail *Photo `json:"thumbnail,omitempty"`
	Title     string `json:"title,omitempty"`
	Performer string `json:"performer,omitempty"`
	MIME      string `json:"mime_type,omitempty"`
	FileName  string `json:"file_name,omitempty"`
}

func (a *Audio) MediaType() string {
	return "audio"
}

func (a *Audio) MediaFile() *File {
	a.fileName = a.FileName
	return &a.File
}

func (a *Audio) InputMedia() InputMedia {
	return InputMedia{
		Type:      a.MediaType(),
		Caption:   a.Caption,
		Duration:  a.Duration,
		Title:     a.Title,
		Performer: a.Performer,
	}
}

// Document object represents a general file (as opposed to Photo or Audio).
// Telegram users can send files of any type of up to 1.5 GB in size.
type Document struct {
	File

	// (Optional)
	Thumbnail            *Photo `json:"thumbnail,omitempty"`
	Caption              string `json:"caption,omitempty"`
	MIME                 string `json:"mime_type"`
	FileName             string `json:"file_name,omitempty"`
	DisableTypeDetection bool   `json:"disable_content_type_detection,omitempty"`
}

func (d *Document) MediaType() string {
	return "document"
}

func (d *Document) MediaFile() *File {
	d.fileName = d.FileName
	return &d.File
}

func (d *Document) InputMedia() InputMedia {
	return InputMedia{
		Type:                 d.MediaType(),
		Caption:              d.Caption,
		DisableTypeDetection: d.DisableTypeDetection,
	}
}

// Video object represents a video file.
type Video struct {
	File

	Width    int `json:"width"`
	Height   int `json:"height"`
	Duration int `json:"duration,omitempty"`

	// (Optional)
	Caption   string `json:"caption,omitempty"`
	Thumbnail *Photo `json:"thumbnail,omitempty"`
	Streaming bool   `json:"supports_streaming,omitempty"`
	MIME      string `json:"mime_type,omitempty"`
	FileName  string `json:"file_name,omitempty"`
}

func (v *Video) MediaType() string {
	return "video"
}

func (v *Video) MediaFile() *File {
	v.fileName = v.FileName
	return &v.File
}

func (v *Video) InputMedia() InputMedia {
	return InputMedia{
		Type:      v.MediaType(),
		Caption:   v.Caption,
		Width:     v.Width,
		Height:    v.Height,
		Duration:  v.Duration,
		Streaming: v.Streaming,
	}
}

// Animation object represents a animation file.
type Animation struct {
	File

	Width    int `json:"width"`
	Height   int `json:"height"`
	Duration int `json:"duration,omitempty"`

	// (Optional)
	Caption   string `json:"caption,omitempty"`
	Thumbnail *Photo `json:"thumbnail,omitempty"`
	MIME      string `json:"mime_type,omitempty"`
	FileName  string `json:"file_name,omitempty"`
}

func (a *Animation) MediaType() string {
	return "animation"
}

func (a *Animation) MediaFile() *File {
	a.fileName = a.FileName
	return &a.File
}

func (a *Animation) InputMedia() InputMedia {
	return InputMedia{
		Type:     a.MediaType(),
		Caption:  a.Caption,
		Width:    a.Width,
		Height:   a.Height,
		Duration: a.Duration,
	}
}

// Voice object represents a voice note.
type Voice struct {
	File

	Duration int `json:"duration"`

	// (Optional)
	Caption string `json:"caption,omitempty"`
	MIME    string `json:"mime_type,omitempty"`
}

func (v *Voice) MediaType() string {
	return "voice"
}

func (v *Voice) MediaFile() *File {
	return &v.File
}

// VideoNote represents a video message.
type VideoNote struct {
	File

	Duration int `json:"duration"`

	// (Optional)
	Thumbnail *Photo `json:"thumbnail,omitempty"`
	Length    int    `json:"length,omitempty"`
}

func (v *VideoNote) MediaType() string {
	return "videoNote"
}

func (v *VideoNote) MediaFile() *File {
	return &v.File
}

// Sticker object represents a WebP image, so-called sticker.
type Sticker struct {
	File
	Type             StickerSetType `json:"type"`
	Width            int            `json:"width"`
	Height           int            `json:"height"`
	Animated         bool           `json:"is_animated"`
	Video            bool           `json:"is_video"`
	Thumbnail        *Photo         `json:"thumbnail"`
	Emoji            string         `json:"emoji"`
	SetName          string         `json:"set_name"`
	PremiumAnimation *File          `json:"premium_animation"`
	MaskPosition     *MaskPosition  `json:"mask_position"`
	CustomEmoji      string         `json:"custom_emoji_id"`
	Repaint          bool           `json:"needs_repainting"`
}

func (s *Sticker) MediaType() string {
	return "sticker"
}

func (s *Sticker) MediaFile() *File {
	return &s.File
}

// Contact object represents a contact to Telegram user.
type Contact struct {
	PhoneNumber string `json:"phone_number"`
	FirstName   string `json:"first_name"`

	// (Optional)
	LastName string `json:"last_name"`
	UserID   int64  `json:"user_id,omitempty"`
}

// Location object represents geographic position.
type Location struct {
	Lat                float32  `json:"latitude"`
	Lng                float32  `json:"longitude"`
	HorizontalAccuracy *float32 `json:"horizontal_accuracy,omitempty"`
	Heading            int      `json:"heading,omitempty"`
	AlertRadius        int      `json:"proximity_alert_radius,omitempty"`

	// Period in seconds for which the location will be updated
	// (see Live Locations, should be between 60 and 86400.)
	LivePeriod int `json:"live_period,omitempty"`
}

// Venue object represents a venue location with name, address and
// optional foursquare ID.
type Venue struct {
	Location Location `json:"location"`
	Title    string   `json:"title"`
	Address  string   `json:"address"`

	// (Optional)
	FoursquareID    string `json:"foursquare_id,omitempty"`
	FoursquareType  string `json:"foursquare_type,omitempty"`
	GooglePlaceID   string `json:"google_place_id,omitempty"`
	GooglePlaceType string `json:"google_place_type,omitempty"`
}

// Dice object represents a dice with a random value
// from 1 to 6 for currently supported base emoji.
type Dice struct {
	Type  DiceType `json:"emoji"`
	Value int      `json:"value"`
}

// DiceType defines dice types.
type DiceType string

var (
	Cube = &Dice{Type: "🎲"}
	Dart = &Dice{Type: "🎯"}
	Ball = &Dice{Type: "🏀"}
	Goal = &Dice{Type: "⚽"}
	Slot = &Dice{Type: "🎰"}
	Bowl = &Dice{Type: "🎳"}
)
