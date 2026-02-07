package telebot

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
)

// Recipient is any possible endpoint you can send
// messages to: either user, group or a channel.
type Recipient interface {
	Recipient() string // must return legit Telegram chat_id or username
}

// Sendable is any object that can send itself.
//
// This is pretty cool, since it lets bots implement
// custom Sendables for complex kind of media or
// chat objects spanning across multiple messages.
type Sendable interface {
	Send(*Bot, Recipient, *SendOptions) (*Message, error)
}

// Send delivers media through bot b to recipient.
func (p *Photo) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id": to.Recipient(),
		"caption": p.Caption,
	}
	b.embedSendOptions(params, opt)

	msg, err := b.sendMedia(p, params, nil)
	if err != nil {
		return nil, err
	}

	msg.Photo.File.stealRef(&p.File)
	*p = *msg.Photo
	p.Caption = msg.Caption

	return msg, nil
}

// Send delivers media through bot b to recipient.
func (a *Audio) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":   to.Recipient(),
		"caption":   a.Caption,
		"performer": a.Performer,
		"title":     a.Title,
		"file_name": a.FileName,
	}
	b.embedSendOptions(params, opt)

	if a.Duration != 0 {
		params["duration"] = strconv.Itoa(a.Duration)
	}

	msg, err := b.sendMedia(a, params, thumbnailToFilemap(a.Thumbnail))
	if err != nil {
		return nil, err
	}

	if msg.Audio != nil {
		msg.Audio.File.stealRef(&a.File)
		*a = *msg.Audio
		a.Caption = msg.Caption
	}

	if msg.Document != nil {
		msg.Document.File.stealRef(&a.File)
		a.File = msg.Document.File
	}

	return msg, nil
}

// Send delivers media through bot b to recipient.
func (d *Document) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":   to.Recipient(),
		"caption":   d.Caption,
		"file_name": d.FileName,
	}
	b.embedSendOptions(params, opt)

	if d.FileSize != 0 {
		params["file_size"] = strconv.FormatInt(d.FileSize, 10)
	}
	if d.DisableTypeDetection {
		params["disable_content_type_detection"] = "true"
	}

	msg, err := b.sendMedia(d, params, thumbnailToFilemap(d.Thumbnail))
	if err != nil {
		return nil, err
	}

	if doc := msg.Document; doc != nil {
		doc.File.stealRef(&d.File)
		*d = *doc
		d.Caption = msg.Caption
	} else if vid := msg.Video; vid != nil {
		vid.File.stealRef(&d.File)
		d.Caption = vid.Caption
		d.MIME = vid.MIME
		d.Thumbnail = vid.Thumbnail
	}

	return msg, nil
}

// Send delivers media through bot b to recipient.
func (s *Sticker) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id": to.Recipient(),
		"emoji":   s.Emoji,
	}
	b.embedSendOptions(params, opt)

	msg, err := b.sendMedia(s, params, nil)
	if err != nil {
		return nil, err
	}

	msg.Sticker.File.stealRef(&s.File)
	*s = *msg.Sticker

	return msg, nil
}

// Send delivers media through bot b to recipient.
func (v *Video) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":   to.Recipient(),
		"caption":   v.Caption,
		"file_name": v.FileName,
	}
	b.embedSendOptions(params, opt)

	if v.Duration != 0 {
		params["duration"] = strconv.Itoa(v.Duration)
	}
	if v.Width != 0 {
		params["width"] = strconv.Itoa(v.Width)
	}
	if v.Height != 0 {
		params["height"] = strconv.Itoa(v.Height)
	}
	if v.Streaming {
		params["supports_streaming"] = "true"
	}

	msg, err := b.sendMedia(v, params, thumbnailToFilemap(v.Thumbnail))
	if err != nil {
		return nil, err
	}

	if vid := msg.Video; vid != nil {
		vid.File.stealRef(&v.File)
		*v = *vid
		v.Caption = msg.Caption
	} else if doc := msg.Document; doc != nil {
		// If video has no sound, Telegram can turn it into Document (GIF)
		doc.File.stealRef(&v.File)

		v.Caption = doc.Caption
		v.MIME = doc.MIME
		v.Thumbnail = doc.Thumbnail
	}

	return msg, nil
}

// Send delivers animation through bot b to recipient.
func (a *Animation) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":   to.Recipient(),
		"caption":   a.Caption,
		"file_name": a.FileName,
	}
	b.embedSendOptions(params, opt)

	if a.Duration != 0 {
		params["duration"] = strconv.Itoa(a.Duration)
	}
	if a.Width != 0 {
		params["width"] = strconv.Itoa(a.Width)
	}
	if a.Height != 0 {
		params["height"] = strconv.Itoa(a.Height)
	}

	// file_name is required, without it animation sends as a document
	if params["file_name"] == "" && a.File.OnDisk() {
		params["file_name"] = filepath.Base(a.File.FileLocal)
	}

	msg, err := b.sendMedia(a, params, thumbnailToFilemap(a.Thumbnail))
	if err != nil {
		return nil, err
	}

	if anim := msg.Animation; anim != nil {
		anim.File.stealRef(&a.File)
		*a = *msg.Animation
	} else if doc := msg.Document; doc != nil {
		*a = Animation{
			File:      doc.File,
			Thumbnail: doc.Thumbnail,
			MIME:      doc.MIME,
			FileName:  doc.FileName,
		}
	}

	a.Caption = msg.Caption
	return msg, nil
}

// Send delivers media through bot b to recipient.
func (v *Voice) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id": to.Recipient(),
		"caption": v.Caption,
	}
	b.embedSendOptions(params, opt)

	if v.Duration != 0 {
		params["duration"] = strconv.Itoa(v.Duration)
	}

	msg, err := b.sendMedia(v, params, nil)
	if err != nil {
		return nil, err
	}

	msg.Voice.File.stealRef(&v.File)
	*v = *msg.Voice

	return msg, nil
}

// Send delivers media through bot b to recipient.
func (v *VideoNote) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id": to.Recipient(),
	}
	b.embedSendOptions(params, opt)

	if v.Duration != 0 {
		params["duration"] = strconv.Itoa(v.Duration)
	}
	if v.Length != 0 {
		params["length"] = strconv.Itoa(v.Length)
	}

	msg, err := b.sendMedia(v, params, thumbnailToFilemap(v.Thumbnail))
	if err != nil {
		return nil, err
	}

	msg.VideoNote.File.stealRef(&v.File)
	*v = *msg.VideoNote

	return msg, nil
}

// Send delivers media through bot b to recipient.
func (x *Location) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":     to.Recipient(),
		"latitude":    fmt.Sprintf("%f", x.Lat),
		"longitude":   fmt.Sprintf("%f", x.Lng),
		"live_period": strconv.Itoa(x.LivePeriod),
	}
	if x.HorizontalAccuracy != nil {
		params["horizontal_accuracy"] = fmt.Sprintf("%f", *x.HorizontalAccuracy)
	}
	if x.Heading != 0 {
		params["heading"] = strconv.Itoa(x.Heading)
	}
	if x.AlertRadius != 0 {
		params["proximity_alert_radius"] = strconv.Itoa(x.Heading)
	}
	b.embedSendOptions(params, opt)

	data, err := b.Raw("sendLocation", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Send delivers media through bot b to recipient.
func (v *Venue) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":           to.Recipient(),
		"latitude":          fmt.Sprintf("%f", v.Location.Lat),
		"longitude":         fmt.Sprintf("%f", v.Location.Lng),
		"title":             v.Title,
		"address":           v.Address,
		"foursquare_id":     v.FoursquareID,
		"foursquare_type":   v.FoursquareType,
		"google_place_id":   v.GooglePlaceID,
		"google_place_type": v.GooglePlaceType,
	}
	b.embedSendOptions(params, opt)

	data, err := b.Raw("sendVenue", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Send delivers invoice through bot b to recipient.
func (i *Invoice) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := i.params()
	params["chat_id"] = to.Recipient()
	b.embedSendOptions(params, opt)

	data, err := b.Raw("sendInvoice", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Send delivers poll through bot b to recipient.
func (p *Poll) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":                 to.Recipient(),
		"question":                p.Question,
		"type":                    string(p.Type),
		"is_closed":               strconv.FormatBool(p.Closed),
		"is_anonymous":            strconv.FormatBool(p.Anonymous),
		"allows_multiple_answers": strconv.FormatBool(p.MultipleAnswers),
		"correct_option_id":       strconv.Itoa(p.CorrectOption),
	}
	if p.Explanation != "" {
		params["explanation"] = p.Explanation
		params["explanation_parse_mode"] = p.ParseMode
	}
	if p.OpenPeriod != 0 {
		params["open_period"] = strconv.Itoa(p.OpenPeriod)
	} else if p.CloseUnixdate != 0 {
		params["close_date"] = strconv.FormatInt(p.CloseUnixdate, 10)
	}
	b.embedSendOptions(params, opt)

	var options []string
	for _, o := range p.Options {
		options = append(options, o.Text)
	}

	opts, _ := json.Marshal(options)
	params["options"] = string(opts)

	data, err := b.Raw("sendPoll", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Send delivers dice through bot b to recipient.
func (d *Dice) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id": to.Recipient(),
		"emoji":   string(d.Type),
	}
	b.embedSendOptions(params, opt)

	data, err := b.Raw("sendDice", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

// Send delivers game through bot b to recipient.
func (g *Game) Send(b *Bot, to Recipient, opt *SendOptions) (*Message, error) {
	params := map[string]string{
		"chat_id":         to.Recipient(),
		"game_short_name": g.Name,
	}
	b.embedSendOptions(params, opt)

	data, err := b.Raw("sendGame", params)
	if err != nil {
		return nil, err
	}

	return extractMessage(data)
}

func thumbnailToFilemap(thumb *Photo) map[string]File {
	if thumb != nil {
		return map[string]File{"thumbnail": thumb.File}
	}
	return nil
}
