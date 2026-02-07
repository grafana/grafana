package telebot

import (
	"encoding/json"
	"strconv"
	"time"
)

// User object represents a Telegram user, bot.
type User struct {
	ID int64 `json:"id"`

	FirstName         string   `json:"first_name"`
	LastName          string   `json:"last_name"`
	IsForum           bool     `json:"is_forum"`
	Username          string   `json:"username"`
	LanguageCode      string   `json:"language_code"`
	IsBot             bool     `json:"is_bot"`
	IsPremium         bool     `json:"is_premium"`
	AddedToMenu       bool     `json:"added_to_attachment_menu"`
	Usernames         []string `json:"active_usernames"`
	CustomEmojiStatus string   `json:"emoji_status_custom_emoji_id"`

	// Returns only in getMe
	CanJoinGroups   bool `json:"can_join_groups"`
	CanReadMessages bool `json:"can_read_all_group_messages"`
	SupportsInline  bool `json:"supports_inline_queries"`
}

// Recipient returns user ID (see Recipient interface).
func (u *User) Recipient() string {
	return strconv.FormatInt(u.ID, 10)
}

// Chat object represents a Telegram user, bot, group or a channel.
type Chat struct {
	ID int64 `json:"id"`

	// See ChatType and consts.
	Type ChatType `json:"type"`

	// Won't be there for ChatPrivate.
	Title string `json:"title"`

	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`

	// Returns only in getChat
	Bio                      string        `json:"bio,omitempty"`
	Photo                    *ChatPhoto    `json:"photo,omitempty"`
	Description              string        `json:"description,omitempty"`
	InviteLink               string        `json:"invite_link,omitempty"`
	PinnedMessage            *Message      `json:"pinned_message,omitempty"`
	Permissions              *Rights       `json:"permissions,omitempty"`
	Reactions                []Reaction    `json:"available_reactions"`
	SlowMode                 int           `json:"slow_mode_delay,omitempty"`
	StickerSet               string        `json:"sticker_set_name,omitempty"`
	CanSetStickerSet         bool          `json:"can_set_sticker_set,omitempty"`
	CustomEmojiSetName       string        `json:"custom_emoji_sticker_set_name"`
	LinkedChatID             int64         `json:"linked_chat_id,omitempty"`
	ChatLocation             *ChatLocation `json:"location,omitempty"`
	Private                  bool          `json:"has_private_forwards,omitempty"`
	Protected                bool          `json:"has_protected_content,omitempty"`
	NoVoiceAndVideo          bool          `json:"has_restricted_voice_and_video_messages"`
	HasHiddenMembers         bool          `json:"has_hidden_members,omitempty"`
	AggressiveAntiSpam       bool          `json:"has_aggressive_anti_spam_enabled,omitempty"`
	CustomEmojiID            string        `json:"emoji_status_custom_emoji_id"`
	EmojiExpirationUnixtime  int64         `json:"emoji_status_expiration_date"`
	BackgroundEmojiID        string        `json:"background_custom_emoji_id"`
	AccentColorID            int           `json:"accent_color_id"`
	ProfileAccentColorID     int           `json:"profile_accent_color_id"`
	ProfileBackgroundEmojiID string        `json:"profile_background_custom_emoji_id"`
	HasVisibleHistory        bool          `json:"has_visible_history"`
	UnrestrictBoosts         int           `json:"unrestrict_boost_count"`
}

// Recipient returns chat ID (see Recipient interface).
func (c *Chat) Recipient() string {
	return strconv.FormatInt(c.ID, 10)
}

// ChatType represents one of the possible chat types.
type ChatType string

const (
	ChatPrivate        ChatType = "private"
	ChatGroup          ChatType = "group"
	ChatSuperGroup     ChatType = "supergroup"
	ChatChannel        ChatType = "channel"
	ChatChannelPrivate ChatType = "privatechannel"
)

// ChatLocation represents a location to which a chat is connected.
type ChatLocation struct {
	Location Location `json:"location,omitempty"`
	Address  string   `json:"address,omitempty"`
}

// ChatPhoto object represents a chat photo.
type ChatPhoto struct {
	// File identifiers of small (160x160) chat photo
	SmallFileID   string `json:"small_file_id"`
	SmallUniqueID string `json:"small_file_unique_id"`

	// File identifiers of big (640x640) chat photo
	BigFileID   string `json:"big_file_id"`
	BigUniqueID string `json:"big_file_unique_id"`
}

// ChatMember object represents information about a single chat member.
type ChatMember struct {
	Rights

	User      *User        `json:"user"`
	Role      MemberStatus `json:"status"`
	Title     string       `json:"custom_title"`
	Anonymous bool         `json:"is_anonymous"`
	Member    bool         `json:"is_member,omitempty"`

	// Date when restrictions will be lifted for the user, unix time.
	//
	// If user is restricted for more than 366 days or less than
	// 30 seconds from the current time, they are considered to be
	// restricted forever.
	//
	// Use tele.Forever().
	//
	RestrictedUntil int64 `json:"until_date,omitempty"`

	JoinToSend    string `json:"join_to_send_messages"`
	JoinByRequest string `json:"join_by_request"`
}

// MemberStatus is one's chat status.
type MemberStatus string

const (
	Creator       MemberStatus = "creator"
	Administrator MemberStatus = "administrator"
	Member        MemberStatus = "member"
	Restricted    MemberStatus = "restricted"
	Left          MemberStatus = "left"
	Kicked        MemberStatus = "kicked"
)

// ChatMemberUpdate object represents changes in the status of a chat member.
type ChatMemberUpdate struct {
	// Chat where the user belongs to.
	Chat *Chat `json:"chat"`

	// Sender which user the action was triggered.
	Sender *User `json:"from"`

	// Unixtime, use Date() to get time.Time.
	Unixtime int64 `json:"date"`

	// Previous information about the chat member.
	OldChatMember *ChatMember `json:"old_chat_member"`

	// New information about the chat member.
	NewChatMember *ChatMember `json:"new_chat_member"`

	// (Optional) InviteLink which was used by the user to
	// join the chat; for joining by invite link events only.
	InviteLink *ChatInviteLink `json:"invite_link"`

	// (Optional) True, if the user joined the chat via a chat folder invite link.
	ViaFolderLink bool `json:"via_chat_folder_invite_link"`
}

// Time returns the moment of the change in local time.
func (c *ChatMemberUpdate) Time() time.Time {
	return time.Unix(c.Unixtime, 0)
}

// ChatID represents a chat or an user integer ID, which can be used
// as recipient in bot methods. It is very useful in cases where
// you have special group IDs, for example in your config, and don't
// want to wrap it into *tele.Chat every time you send messages.
//
// Example:
//
//	group := tele.ChatID(-100756389456)
//	b.Send(group, "Hello!")
//
//	type Config struct {
//		AdminGroup tele.ChatID `json:"admin_group"`
//	}
//	b.Send(conf.AdminGroup, "Hello!")
type ChatID int64

// Recipient returns chat ID (see Recipient interface).
func (i ChatID) Recipient() string {
	return strconv.FormatInt(int64(i), 10)
}

// ChatJoinRequest represents a join request sent to a chat.
type ChatJoinRequest struct {
	// Chat to which the request was sent.
	Chat *Chat `json:"chat"`

	// Sender is the user that sent the join request.
	Sender *User `json:"from"`

	// UserChatID is an ID of a private chat with the user
	// who sent the join request. The bot can use this ID
	// for 5 minutes to send messages until the join request
	// is processed, assuming no other administrator contacted the user.
	UserChatID int64 `json:"user_chat_id"`

	// Unixtime, use ChatJoinRequest.Time() to get time.Time.
	Unixtime int64 `json:"date"`

	// Bio of the user, optional.
	Bio string `json:"bio"`

	// InviteLink is the chat invite link that was used by
	//the user to send the join request, optional.
	InviteLink *ChatInviteLink `json:"invite_link"`
}

// ChatInviteLink object represents an invite for a chat.
type ChatInviteLink struct {
	// The invite link.
	InviteLink string `json:"invite_link"`

	// Invite link name.
	Name string `json:"name"`

	// The creator of the link.
	Creator *User `json:"creator"`

	// If the link is primary.
	IsPrimary bool `json:"is_primary"`

	// If the link is revoked.
	IsRevoked bool `json:"is_revoked"`

	// (Optional) Point in time when the link will expire,
	// use ExpireDate() to get time.Time.
	ExpireUnixtime int64 `json:"expire_date,omitempty"`

	// (Optional) Maximum number of users that can be members of
	// the chat simultaneously.
	MemberLimit int `json:"member_limit,omitempty"`

	// (Optional) True, if users joining the chat via the link need to
	// be approved by chat administrators. If True, member_limit can't be specified.
	JoinRequest bool `json:"creates_join_request"`

	// (Optional) Number of pending join requests created using this link.
	PendingCount int `json:"pending_join_request_count"`
}

type Story struct {
	// Unique identifier for the story in the chat
	ID int `json:"id"`

	// Chat that posted the story
	Poster *Chat `json:"chat"`
}

// ExpireDate returns the moment of the link expiration in local time.
func (c *ChatInviteLink) ExpireDate() time.Time {
	return time.Unix(c.ExpireUnixtime, 0)
}

// Time returns the moment of chat join request sending in local time.
func (r ChatJoinRequest) Time() time.Time {
	return time.Unix(r.Unixtime, 0)
}

// Time returns the moment of the emoji status expiration.
func (c *Chat) Time() time.Time {
	return time.Unix(c.EmojiExpirationUnixtime, 0)
}

// InviteLink should be used to export chat's invite link.
func (b *Bot) InviteLink(chat *Chat) (string, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	data, err := b.Raw("exportChatInviteLink", params)
	if err != nil {
		return "", err
	}

	var resp struct {
		Result string
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return "", wrapError(err)
	}
	return resp.Result, nil
}

// CreateInviteLink creates an additional invite link for a chat.
func (b *Bot) CreateInviteLink(chat Recipient, link *ChatInviteLink) (*ChatInviteLink, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}
	if link != nil {
		params["name"] = link.Name

		if link.ExpireUnixtime != 0 {
			params["expire_date"] = strconv.FormatInt(link.ExpireUnixtime, 10)
		}
		if link.MemberLimit > 0 {
			params["member_limit"] = strconv.Itoa(link.MemberLimit)
		} else if link.JoinRequest {
			params["creates_join_request"] = "true"
		}
	}

	data, err := b.Raw("createChatInviteLink", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result ChatInviteLink `json:"result"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}

	return &resp.Result, nil
}

// EditInviteLink edits a non-primary invite link created by the bot.
func (b *Bot) EditInviteLink(chat Recipient, link *ChatInviteLink) (*ChatInviteLink, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}
	if link != nil {
		params["invite_link"] = link.InviteLink
		params["name"] = link.Name

		if link.ExpireUnixtime != 0 {
			params["expire_date"] = strconv.FormatInt(link.ExpireUnixtime, 10)
		}
		if link.MemberLimit > 0 {
			params["member_limit"] = strconv.Itoa(link.MemberLimit)
		} else if link.JoinRequest {
			params["creates_join_request"] = "true"
		}
	}

	data, err := b.Raw("editChatInviteLink", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result ChatInviteLink `json:"result"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}

	return &resp.Result, nil
}

// RevokeInviteLink revokes an invite link created by the bot.
func (b *Bot) RevokeInviteLink(chat Recipient, link string) (*ChatInviteLink, error) {
	params := map[string]string{
		"chat_id":     chat.Recipient(),
		"invite_link": link,
	}

	data, err := b.Raw("revokeChatInviteLink", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result ChatInviteLink `json:"result"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}

	return &resp.Result, nil
}

// ApproveJoinRequest approves a chat join request.
func (b *Bot) ApproveJoinRequest(chat Recipient, user *User) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
		"user_id": user.Recipient(),
	}

	data, err := b.Raw("approveChatJoinRequest", params)
	if err != nil {
		return err
	}

	return extractOk(data)
}

// DeclineJoinRequest declines a chat join request.
func (b *Bot) DeclineJoinRequest(chat Recipient, user *User) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
		"user_id": user.Recipient(),
	}

	data, err := b.Raw("declineChatJoinRequest", params)
	if err != nil {
		return err
	}

	return extractOk(data)
}

// SetGroupTitle should be used to update group title.
func (b *Bot) SetGroupTitle(chat *Chat, title string) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
		"title":   title,
	}

	_, err := b.Raw("setChatTitle", params)
	return err
}

// SetGroupDescription should be used to update group description.
func (b *Bot) SetGroupDescription(chat *Chat, description string) error {
	params := map[string]string{
		"chat_id":     chat.Recipient(),
		"description": description,
	}

	_, err := b.Raw("setChatDescription", params)
	return err
}

// SetGroupPhoto should be used to update group photo.
func (b *Bot) SetGroupPhoto(chat *Chat, p *Photo) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	_, err := b.sendFiles("setChatPhoto", map[string]File{"photo": p.File}, params)
	return err
}

// SetGroupStickerSet should be used to update group's group sticker set.
func (b *Bot) SetGroupStickerSet(chat *Chat, setName string) error {
	params := map[string]string{
		"chat_id":          chat.Recipient(),
		"sticker_set_name": setName,
	}

	_, err := b.Raw("setChatStickerSet", params)
	return err
}

// SetGroupPermissions sets default chat permissions for all members.
func (b *Bot) SetGroupPermissions(chat *Chat, perms Rights) error {
	params := map[string]interface{}{
		"chat_id":     chat.Recipient(),
		"permissions": perms,
	}
	if perms.Independent {
		params["use_independent_chat_permissions"] = true
	}

	_, err := b.Raw("setChatPermissions", params)
	return err
}

// DeleteGroupPhoto should be used to just remove group photo.
func (b *Bot) DeleteGroupPhoto(chat *Chat) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	_, err := b.Raw("deleteChatPhoto", params)
	return err
}

// DeleteGroupStickerSet should be used to just remove group sticker set.
func (b *Bot) DeleteGroupStickerSet(chat *Chat) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	_, err := b.Raw("deleteChatStickerSet", params)
	return err
}
