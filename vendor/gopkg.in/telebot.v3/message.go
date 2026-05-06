package telebot

import (
	"strconv"
	"time"
	"unicode/utf16"
)

// Message object represents a message.
type Message struct {
	ID int `json:"message_id"`

	// (Optional) Unique identifier of a message thread to which the message belongs; for supergroups only
	ThreadID int `json:"message_thread_id"`

	// For message sent to channels, Sender will be nil
	Sender *User `json:"from"`

	// Unixtime, use Message.Time() to get time.Time
	Unixtime int64 `json:"date"`

	// Conversation the message belongs to.
	Chat *Chat `json:"chat"`

	// Sender of the message, sent on behalf of a chat.
	SenderChat *Chat `json:"sender_chat"`

	// For forwarded messages, sender of the original message.
	OriginalSender *User `json:"forward_from"`

	// For forwarded messages, chat of the original message when
	// forwarded from a channel.
	OriginalChat *Chat `json:"forward_from_chat"`

	// For forwarded messages, identifier of the original message
	// when forwarded from a channel.
	OriginalMessageID int `json:"forward_from_message_id"`

	// For forwarded messages, signature of the post author.
	OriginalSignature string `json:"forward_signature"`

	// For forwarded messages, sender's name from users who
	// disallow adding a link to their account.
	OriginalSenderName string `json:"forward_sender_name"`

	// For forwarded messages, unixtime of the original message.
	OriginalUnixtime int `json:"forward_date"`

	// Message is a channel post that was automatically forwarded to the connected discussion group.
	AutomaticForward bool `json:"is_automatic_forward"`

	// For replies, ReplyTo represents the original message.
	//
	// Note that the Message object in this field will not
	// contain further ReplyTo fields even if it
	// itself is a reply.
	ReplyTo *Message `json:"reply_to_message"`

	// Shows through which bot the message was sent.
	Via *User `json:"via_bot"`

	// (Optional) Time of last edit in Unix.
	LastEdit int64 `json:"edit_date"`

	// (Optional) True, if the message is sent to a forum topic.
	TopicMessage bool `json:"is_topic_message"`

	// (Optional) Message can't be forwarded.
	Protected bool `json:"has_protected_content,omitempty"`

	// AlbumID is the unique identifier of a media message group
	// this message belongs to.
	AlbumID string `json:"media_group_id"`

	// Author signature (in channels).
	Signature string `json:"author_signature"`

	// For a text message, the actual UTF-8 text of the message.
	Text string `json:"text"`

	// For registered commands, will contain the string payload:
	//
	// Ex: `/command <payload>` or `/command@botname <payload>`
	Payload string `json:"-"`

	// For text messages, special entities like usernames, URLs, bot commands,
	// etc. that appear in the text.
	Entities Entities `json:"entities,omitempty"`

	// Some messages containing media, may as well have a caption.
	Caption string `json:"caption,omitempty"`

	// For messages with a caption, special entities like usernames, URLs,
	// bot commands, etc. that appear in the caption.
	CaptionEntities Entities `json:"caption_entities,omitempty"`

	// For an audio recording, information about it.
	Audio *Audio `json:"audio"`

	// For a general file, information about it.
	Document *Document `json:"document"`

	// For a photo, all available sizes (thumbnails).
	Photo *Photo `json:"photo"`

	// For a sticker, information about it.
	Sticker *Sticker `json:"sticker"`

	// For a voice message, information about it.
	Voice *Voice `json:"voice"`

	// For a video note, information about it.
	VideoNote *VideoNote `json:"video_note"`

	// For a video, information about it.
	Video *Video `json:"video"`

	// For a animation, information about it.
	Animation *Animation `json:"animation"`

	// For a contact, contact information itself.
	Contact *Contact `json:"contact"`

	// For a location, its longitude and latitude.
	Location *Location `json:"location"`

	// For a venue, information about it.
	Venue *Venue `json:"venue"`

	// For a poll, information the native poll.
	Poll *Poll `json:"poll"`

	// For a game, information about it.
	Game *Game `json:"game"`

	// For a dice, information about it.
	Dice *Dice `json:"dice"`

	// For a service message, represents a user,
	// that just got added to chat, this message came from.
	//
	// Sender leads to User, capable of invite.
	//
	// UserJoined might be the Bot itself.
	UserJoined *User `json:"new_chat_member"`

	// For a service message, represents a user,
	// that just left chat, this message came from.
	//
	// If user was kicked, Sender leads to a User,
	// capable of this kick.
	//
	// UserLeft might be the Bot itself.
	UserLeft *User `json:"left_chat_member"`

	// For a service message, represents a new title
	// for chat this message came from.
	//
	// Sender would lead to a User, capable of change.
	NewGroupTitle string `json:"new_chat_title"`

	// For a service message, represents all available
	// thumbnails of the new chat photo.
	//
	// Sender would lead to a User, capable of change.
	NewGroupPhoto *Photo `json:"new_chat_photo"`

	// For a service message, new members that were added to
	// the group or supergroup and information about them
	// (the bot itself may be one of these members).
	UsersJoined []User `json:"new_chat_members"`

	// For a service message, true if chat photo just
	// got removed.
	//
	// Sender would lead to a User, capable of change.
	GroupPhotoDeleted bool `json:"delete_chat_photo"`

	// For a service message, true if group has been created.
	//
	// You would receive such a message if you are one of
	// initial group chat members.
	//
	// Sender would lead to creator of the chat.
	GroupCreated bool `json:"group_chat_created"`

	// For a service message, true if supergroup has been created.
	//
	// You would receive such a message if you are one of
	// initial group chat members.
	//
	// Sender would lead to creator of the chat.
	SuperGroupCreated bool `json:"supergroup_chat_created"`

	// For a service message, true if channel has been created.
	//
	// You would receive such a message if you are one of
	// initial channel administrators.
	//
	// Sender would lead to creator of the chat.
	ChannelCreated bool `json:"channel_chat_created"`

	// For a service message, the destination (supergroup) you
	// migrated to.
	//
	// You would receive such a message when your chat has migrated
	// to a supergroup.
	//
	// Sender would lead to creator of the migration.
	MigrateTo int64 `json:"migrate_to_chat_id"`

	// For a service message, the Origin (normal group) you migrated
	// from.
	//
	// You would receive such a message when your chat has migrated
	// to a supergroup.
	//
	// Sender would lead to creator of the migration.
	MigrateFrom int64 `json:"migrate_from_chat_id"`

	// Specified message was pinned. Note that the Message object
	// in this field will not contain further ReplyTo fields even
	// if it is itself a reply.
	PinnedMessage *Message `json:"pinned_message"`

	// Message is an invoice for a payment.
	Invoice *Invoice `json:"invoice"`

	// Message is a service message about a successful payment.
	Payment *Payment `json:"successful_payment"`

	// For a service message, a user was shared with the bot.
	UserShared *RecipientShared `json:"user_shared,omitempty"`

	// For a service message, a chat was shared with the bot.
	ChatShared *RecipientShared `json:"chat_shared,omitempty"`

	// The domain name of the website on which the user has logged in.
	ConnectedWebsite string `json:"connected_website,omitempty"`

	// For a service message, a video chat started in the chat.
	VideoChatStarted *VideoChatStarted `json:"video_chat_started,omitempty"`

	// For a service message, a video chat ended in the chat.
	VideoChatEnded *VideoChatEnded `json:"video_chat_ended,omitempty"`

	// For a service message, some users were invited in the video chat.
	VideoChatParticipants *VideoChatParticipants `json:"video_chat_participants_invited,omitempty"`

	// For a service message, a video chat schedule in the chat.
	VideoChatScheduled *VideoChatScheduled `json:"video_chat_scheduled,omitempty"`

	// For a data sent by a Web App.
	WebAppData *WebAppData `json:"web_app_data,omitempty"`

	// For a service message, represents the content of a service message,
	// sent whenever a user in the chat triggers a proximity alert set by another user.
	ProximityAlert *ProximityAlert `json:"proximity_alert_triggered,omitempty"`

	// For a service message, represents about a change in auto-delete timer settings.
	AutoDeleteTimer *AutoDeleteTimer `json:"message_auto_delete_timer_changed,omitempty"`

	// Inline keyboard attached to the message.
	ReplyMarkup *ReplyMarkup `json:"reply_markup,omitempty"`

	// Service message: forum topic created
	TopicCreated *Topic `json:"forum_topic_created,omitempty"`

	// Service message: forum topic closed
	TopicClosed *struct{} `json:"forum_topic_closed,omitempty"`

	// Service message: forum topic reopened
	TopicReopened *Topic `json:"forum_topic_reopened,omitempty"`

	// Service message: forum topic deleted
	TopicEdited *Topic `json:"forum_topic_edited,omitempty"`

	// Service message: general forum topic hidden
	GeneralTopicHidden *struct{} `json:"general_topic_hidden,omitempty"`

	// Service message: general forum topic unhidden
	GeneralTopicUnhidden *struct{} `json:"general_topic_unhidden,omitempty"`

	// Service message: represents spoiler information about the message.
	HasMediaSpoiler bool `json:"has_media_spoiler,omitempty"`

	// Service message: the user allowed the bot added to the attachment menu to write messages
	WriteAccessAllowed *WriteAccessAllowed `json:"write_access_allowed,omitempty"`
}

// MessageEntity object represents "special" parts of text messages,
// including hashtags, usernames, URLs, etc.
type MessageEntity struct {
	// Specifies entity type.
	Type EntityType `json:"type"`

	// Offset in UTF-16 code units to the start of the entity.
	Offset int `json:"offset"`

	// Length of the entity in UTF-16 code units.
	Length int `json:"length"`

	// (Optional) For EntityTextLink entity type only.
	//
	// URL will be opened after user taps on the text.
	URL string `json:"url,omitempty"`

	// (Optional) For EntityTMention entity type only.
	User *User `json:"user,omitempty"`

	// (Optional) For EntityCodeBlock entity type only.
	Language string `json:"language,omitempty"`

	// (Optional) For EntityCustomEmoji entity type only.
	CustomEmoji string `json:"custom_emoji_id"`
}

// EntityType is a MessageEntity type.
type EntityType string

const (
	EntityMention       EntityType = "mention"
	EntityTMention      EntityType = "text_mention"
	EntityHashtag       EntityType = "hashtag"
	EntityCashtag       EntityType = "cashtag"
	EntityCommand       EntityType = "bot_command"
	EntityURL           EntityType = "url"
	EntityEmail         EntityType = "email"
	EntityPhone         EntityType = "phone_number"
	EntityBold          EntityType = "bold"
	EntityItalic        EntityType = "italic"
	EntityUnderline     EntityType = "underline"
	EntityStrikethrough EntityType = "strikethrough"
	EntityCode          EntityType = "code"
	EntityCodeBlock     EntityType = "pre"
	EntityTextLink      EntityType = "text_link"
	EntitySpoiler       EntityType = "spoiler"
	EntityCustomEmoji   EntityType = "custom_emoji"
)

// Entities is used to set message's text entities as a send option.
type Entities []MessageEntity

// ProximityAlert sent whenever a user in the chat triggers
// a proximity alert set by another user.
type ProximityAlert struct {
	Traveler *User `json:"traveler,omitempty"`
	Watcher  *User `json:"watcher,omitempty"`
	Distance int   `json:"distance"`
}

// AutoDeleteTimer represents a service message about a change in auto-delete timer settings.
type AutoDeleteTimer struct {
	Unixtime int `json:"message_auto_delete_time"`
}

// MessageSig satisfies Editable interface (see Editable.)
func (m *Message) MessageSig() (string, int64) {
	return strconv.Itoa(m.ID), m.Chat.ID
}

// Time returns the moment of message creation in local time.
func (m *Message) Time() time.Time {
	return time.Unix(m.Unixtime, 0)
}

// LastEdited returns time.Time of last edit.
func (m *Message) LastEdited() time.Time {
	return time.Unix(m.LastEdit, 0)
}

// IsForwarded says whether message is forwarded copy of another
// message or not.
func (m *Message) IsForwarded() bool {
	return m.OriginalSender != nil || m.OriginalChat != nil
}

// IsReply says whether message is a reply to another message.
func (m *Message) IsReply() bool {
	return m.ReplyTo != nil
}

// Private returns true, if it's a personal message.
func (m *Message) Private() bool {
	return m.Chat.Type == ChatPrivate
}

// FromGroup returns true, if message came from a group OR a supergroup.
func (m *Message) FromGroup() bool {
	return m.Chat.Type == ChatGroup || m.Chat.Type == ChatSuperGroup
}

// FromChannel returns true, if message came from a channel.
func (m *Message) FromChannel() bool {
	return m.Chat.Type == ChatChannel
}

// IsService returns true, if message is a service message,
// returns false otherwise.
//
// Service messages are automatically sent messages, which
// typically occur on some global action. For instance, when
// anyone leaves the chat or chat title changes.
func (m *Message) IsService() bool {
	fact := false

	fact = fact || m.UserJoined != nil
	fact = fact || len(m.UsersJoined) > 0
	fact = fact || m.UserLeft != nil
	fact = fact || m.NewGroupTitle != ""
	fact = fact || m.NewGroupPhoto != nil
	fact = fact || m.GroupPhotoDeleted
	fact = fact || m.GroupCreated || m.SuperGroupCreated
	fact = fact || (m.MigrateTo != m.MigrateFrom)

	return fact
}

// EntityText returns the substring of the message identified by the
// given MessageEntity.
//
// It's safer than manually slicing Text because Telegram uses
// UTF-16 indices whereas Go string are []byte.
func (m *Message) EntityText(e MessageEntity) string {
	text := m.Text
	if text == "" {
		text = m.Caption
	}

	a := utf16.Encode([]rune(text))
	off, end := e.Offset, e.Offset+e.Length

	if off < 0 || end > len(a) {
		return ""
	}

	return string(utf16.Decode(a[off:end]))
}

// Media returns the message's media if it contains either photo,
// voice, audio, animation, sticker, document, video or video note.
func (m *Message) Media() Media {
	switch {
	case m.Photo != nil:
		return m.Photo
	case m.Voice != nil:
		return m.Voice
	case m.Audio != nil:
		return m.Audio
	case m.Animation != nil:
		return m.Animation
	case m.Sticker != nil:
		return m.Sticker
	case m.Document != nil:
		return m.Document
	case m.Video != nil:
		return m.Video
	case m.VideoNote != nil:
		return m.VideoNote
	default:
		return nil
	}
}
