package telebot

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
)

type (
	StickerSetType   = string
	StickerSetFormat = string
	MaskFeature      = string
)

const (
	StickerRegular     StickerSetType = "regular"
	StickerMask        StickerSetType = "mask"
	StickerCustomEmoji StickerSetType = "custom_emoji"
)

const (
	StickerStatic   StickerSetFormat = "static"
	StickerAnimated StickerSetFormat = "animated"
	StickerVideo    StickerSetFormat = "video"
)

const (
	MaskForehead MaskFeature = "forehead"
	MaskEyes     MaskFeature = "eyes"
	MaskMouth    MaskFeature = "mouth"
	MaskChin     MaskFeature = "chin"
)

// StickerSet represents a sticker set.
type StickerSet struct {
	Type          StickerSetType   `json:"sticker_type"`
	Format        StickerSetFormat `json:"sticker_format"`
	Name          string           `json:"name"`
	Title         string           `json:"title"`
	Animated      bool             `json:"is_animated"`
	Video         bool             `json:"is_video"`
	Stickers      []Sticker        `json:"stickers"`
	Thumbnail     *Photo           `json:"thumbnail"`
	Emojis        string           `json:"emojis"`
	ContainsMasks bool             `json:"contains_masks"` // FIXME: can be removed
	MaskPosition  *MaskPosition    `json:"mask_position"`
	Repaint       bool             `json:"needs_repainting"`

	// Input is a field used in createNewStickerSet method to specify a list
	// of pre-defined stickers of type InputSticker to add to the set.
	Input []InputSticker
}

type InputSticker struct {
	File
	Sticker      string        `json:"sticker"`
	MaskPosition *MaskPosition `json:"mask_position"`
	Emojis       []string      `json:"emoji_list"`
	Keywords     []string      `json:"keywords"`
}

// MaskPosition describes the position on faces where
// a mask should be placed by default.
type MaskPosition struct {
	Feature MaskFeature `json:"point"`
	XShift  float32     `json:"x_shift"`
	YShift  float32     `json:"y_shift"`
	Scale   float32     `json:"scale"`
}

// UploadSticker uploads a sticker file for later use.
func (b *Bot) UploadSticker(to Recipient, format StickerSetFormat, f File) (*File, error) {
	params := map[string]string{
		"user_id":        to.Recipient(),
		"sticker_format": format,
	}

	data, err := b.sendFiles("uploadStickerFile", map[string]File{"0": f}, params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result File
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return &resp.Result, nil
}

// StickerSet returns a sticker set on success.
func (b *Bot) StickerSet(name string) (*StickerSet, error) {
	data, err := b.Raw("getStickerSet", map[string]string{"name": name})
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *StickerSet
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// CreateStickerSet creates a new sticker set.
func (b *Bot) CreateStickerSet(of Recipient, set *StickerSet) error {
	files := make(map[string]File)
	for i, s := range set.Input {
		repr := s.File.process(strconv.Itoa(i), files)
		if repr == "" {
			return fmt.Errorf("telebot: sticker #%d does not exist", i+1)
		}
		set.Input[i].Sticker = repr
	}

	data, _ := json.Marshal(set.Input)

	params := map[string]string{
		"user_id":        of.Recipient(),
		"name":           set.Name,
		"title":          set.Title,
		"sticker_format": set.Format,
		"stickers":       string(data),
	}
	if set.Type != "" {
		params["sticker_type"] = set.Type
	}
	if set.Repaint {
		params["needs_repainting"] = "true"
	}

	_, err := b.sendFiles("createNewStickerSet", files, params)
	return err
}

// AddStickerToSet adds a new sticker to the existing sticker set.
func (b *Bot) AddStickerToSet(of Recipient, name string, sticker InputSticker) error {
	files := make(map[string]File)
	repr := sticker.File.process("0", files)
	if repr == "" {
		return errors.New("telebot: sticker does not exist")
	}

	sticker.Sticker = repr
	data, _ := json.Marshal(sticker)

	params := map[string]string{
		"user_id": of.Recipient(),
		"name":    name,
		"sticker": string(data),
	}

	_, err := b.sendFiles("addStickerToSet", files, params)
	return err
}

// SetStickerPosition moves a sticker in set to a specific position.
func (b *Bot) SetStickerPosition(sticker string, position int) error {
	params := map[string]string{
		"sticker":  sticker,
		"position": strconv.Itoa(position),
	}

	_, err := b.Raw("setStickerPositionInSet", params)
	return err
}

// DeleteSticker deletes a sticker from a set created by the bot.
func (b *Bot) DeleteSticker(sticker string) error {
	_, err := b.Raw("deleteStickerFromSet", map[string]string{"sticker": sticker})
	return err

}

// SetStickerSetThumb sets a thumbnail of the sticker set.
// Animated thumbnails can be set for animated sticker sets only.
//
// Thumbnail must be a PNG image, up to 128 kilobytes in size
// and have width and height exactly 100px, or a TGS animation
// up to 32 kilobytes in size.
//
// Animated sticker set thumbnail can't be uploaded via HTTP URL.
func (b *Bot) SetStickerSetThumb(of Recipient, set *StickerSet) error {
	if set.Thumbnail == nil {
		return errors.New("telebot: thumbnail is required")
	}

	files := make(map[string]File)
	repr := set.Thumbnail.File.process("thumb", files)
	if repr == "" {
		return errors.New("telebot: thumbnail does not exist")
	}

	params := map[string]string{
		"user_id":   of.Recipient(),
		"name":      set.Name,
		"thumbnail": repr,
	}

	_, err := b.sendFiles("setStickerSetThumbnail", files, params)
	return err
}

// SetStickerSetTitle sets the title of a created sticker set.
func (b *Bot) SetStickerSetTitle(s StickerSet) error {
	params := map[string]string{
		"name":  s.Name,
		"title": s.Title,
	}

	_, err := b.Raw("setStickerSetTitle", params)
	return err
}

// DeleteStickerSet deletes a sticker set that was created by the bot.
func (b *Bot) DeleteStickerSet(name string) error {
	params := map[string]string{"name": name}

	_, err := b.Raw("deleteStickerSet", params)
	return err
}

// SetStickerEmojis changes the list of emoji assigned to a regular or custom emoji sticker.
func (b *Bot) SetStickerEmojis(sticker string, emojis []string) error {
	data, err := json.Marshal(emojis)
	if err != nil {
		return err
	}

	params := map[string]string{
		"sticker":    sticker,
		"emoji_list": string(data),
	}

	_, err = b.Raw("setStickerEmojiList", params)
	return err
}

// SetStickerKeywords changes search keywords assigned to a regular or custom emoji sticker.
func (b *Bot) SetStickerKeywords(sticker string, keywords []string) error {
	mk, err := json.Marshal(keywords)
	if err != nil {
		return err
	}

	params := map[string]string{
		"sticker":  sticker,
		"keywords": string(mk),
	}

	_, err = b.Raw("setStickerKeywords", params)
	return err
}

// SetStickerMaskPosition changes the mask position of a mask sticker.
func (b *Bot) SetStickerMaskPosition(sticker string, mask MaskPosition) error {
	data, err := json.Marshal(mask)
	if err != nil {
		return err
	}

	params := map[string]string{
		"sticker":       sticker,
		"mask_position": string(data),
	}

	_, err = b.Raw("setStickerMaskPosition", params)
	return err
}

// CustomEmojiStickers returns the information about custom emoji stickers by their ids.
func (b *Bot) CustomEmojiStickers(ids []string) ([]Sticker, error) {
	data, _ := json.Marshal(ids)

	params := map[string]string{
		"custom_emoji_ids": string(data),
	}

	data, err := b.Raw("getCustomEmojiStickers", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result []Sticker
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// SetCustomEmojiStickerSetThumb sets the thumbnail of a custom emoji sticker set.
func (b *Bot) SetCustomEmojiStickerSetThumb(name, id string) error {
	params := map[string]string{
		"name":            name,
		"custom_emoji_id": id,
	}

	_, err := b.Raw("setCustomEmojiStickerSetThumbnail", params)
	return err
}
