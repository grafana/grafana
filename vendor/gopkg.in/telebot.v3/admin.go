package telebot

import (
	"encoding/json"
	"strconv"
	"time"
)

// Rights is a list of privileges available to chat members.
type Rights struct {
	// Anonymous is true, if the user's presence in the chat is hidden.
	Anonymous bool `json:"is_anonymous"`

	CanBeEdited         bool `json:"can_be_edited"`
	CanChangeInfo       bool `json:"can_change_info"`
	CanPostMessages     bool `json:"can_post_messages"`
	CanEditMessages     bool `json:"can_edit_messages"`
	CanDeleteMessages   bool `json:"can_delete_messages"`
	CanPinMessages      bool `json:"can_pin_messages"`
	CanInviteUsers      bool `json:"can_invite_users"`
	CanRestrictMembers  bool `json:"can_restrict_members"`
	CanPromoteMembers   bool `json:"can_promote_members"`
	CanSendMessages     bool `json:"can_send_messages"`
	CanSendPolls        bool `json:"can_send_polls"`
	CanSendOther        bool `json:"can_send_other_messages"`
	CanAddPreviews      bool `json:"can_add_web_page_previews"`
	CanManageVideoChats bool `json:"can_manage_video_chats"`
	CanManageChat       bool `json:"can_manage_chat"`
	CanManageTopics     bool `json:"can_manage_topics"`

	CanSendMedia      bool `json:"can_send_media_messages,omitempty"` // deprecated
	CanSendAudios     bool `json:"can_send_audios"`
	CanSendDocuments  bool `json:"can_send_documents"`
	CanSendPhotos     bool `json:"can_send_photos"`
	CanSendVideos     bool `json:"can_send_videos"`
	CanSendVideoNotes bool `json:"can_send_video_notes"`
	CanSendVoiceNotes bool `json:"can_send_voice_notes"`

	// Independent defines whether the chat permissions are set independently.
	// If not, the can_send_other_messages and can_add_web_page_previews permissions
	// will imply the can_send_messages, can_send_audios, can_send_documents, can_send_photos,
	// can_send_videos, can_send_video_notes, and can_send_voice_notes permissions;
	// the can_send_polls permission will imply the can_send_messages permission.
	//
	// Works for Restrict and SetGroupPermissions methods only.
	Independent bool `json:"-"`
}

// NoRights is the default Rights{}.
func NoRights() Rights { return Rights{} }

// NoRestrictions should be used when un-restricting or
// un-promoting user.
//
//	member.Rights = tele.NoRestrictions()
//	b.Restrict(chat, member)
func NoRestrictions() Rights {
	return Rights{
		CanBeEdited:         true,
		CanChangeInfo:       false,
		CanPostMessages:     false,
		CanEditMessages:     false,
		CanDeleteMessages:   false,
		CanInviteUsers:      false,
		CanRestrictMembers:  false,
		CanPinMessages:      false,
		CanPromoteMembers:   false,
		CanSendMessages:     true,
		CanSendPolls:        true,
		CanSendOther:        true,
		CanAddPreviews:      true,
		CanManageVideoChats: false,
		CanManageChat:       false,
		CanManageTopics:     false,
		CanSendAudios:       true,
		CanSendDocuments:    true,
		CanSendPhotos:       true,
		CanSendVideos:       true,
		CanSendVideoNotes:   true,
		CanSendVoiceNotes:   true,
	}
}

// AdminRights could be used to promote user to admin.
func AdminRights() Rights {
	return Rights{
		CanBeEdited:         true,
		CanChangeInfo:       true,
		CanPostMessages:     true,
		CanEditMessages:     true,
		CanDeleteMessages:   true,
		CanInviteUsers:      true,
		CanRestrictMembers:  true,
		CanPinMessages:      true,
		CanPromoteMembers:   true,
		CanSendMessages:     true,
		CanSendPolls:        true,
		CanSendOther:        true,
		CanAddPreviews:      true,
		CanManageVideoChats: true,
		CanManageChat:       true,
		CanManageTopics:     true,
		CanSendAudios:       true,
		CanSendDocuments:    true,
		CanSendPhotos:       true,
		CanSendVideos:       true,
		CanSendVideoNotes:   true,
		CanSendVoiceNotes:   true,
	}
}

// Forever is a ExpireUnixtime of "forever" banning.
func Forever() int64 {
	return time.Now().Add(367 * 24 * time.Hour).Unix()
}

// Ban will ban user from chat until `member.RestrictedUntil`.
func (b *Bot) Ban(chat *Chat, member *ChatMember, revokeMessages ...bool) error {
	params := map[string]string{
		"chat_id":    chat.Recipient(),
		"user_id":    member.User.Recipient(),
		"until_date": strconv.FormatInt(member.RestrictedUntil, 10),
	}
	if len(revokeMessages) > 0 {
		params["revoke_messages"] = strconv.FormatBool(revokeMessages[0])
	}

	_, err := b.Raw("kickChatMember", params)
	return err
}

// Unban will unban user from chat, who would have thought eh?
// forBanned does nothing if the user is not banned.
func (b *Bot) Unban(chat *Chat, user *User, forBanned ...bool) error {
	params := map[string]string{
		"chat_id": chat.Recipient(),
		"user_id": user.Recipient(),
	}

	if len(forBanned) > 0 {
		params["only_if_banned"] = strconv.FormatBool(forBanned[0])
	}

	_, err := b.Raw("unbanChatMember", params)
	return err
}

// Restrict lets you restrict a subset of member's rights until
// member.RestrictedUntil, such as:
//
//   - can send messages
//   - can send media
//   - can send other
//   - can add web page previews
func (b *Bot) Restrict(chat *Chat, member *ChatMember) error {
	perms, until := member.Rights, member.RestrictedUntil

	params := map[string]interface{}{
		"chat_id":     chat.Recipient(),
		"user_id":     member.User.Recipient(),
		"until_date":  strconv.FormatInt(until, 10),
		"permissions": perms,
	}
	if perms.Independent {
		params["use_independent_chat_permissions"] = true
	}

	_, err := b.Raw("restrictChatMember", params)
	return err
}

// Promote lets you update member's admin rights, such as:
//
//   - can change info
//   - can post messages
//   - can edit messages
//   - can delete messages
//   - can invite users
//   - can restrict members
//   - can pin messages
//   - can promote members
func (b *Bot) Promote(chat *Chat, member *ChatMember) error {
	params := map[string]interface{}{
		"chat_id":      chat.Recipient(),
		"user_id":      member.User.Recipient(),
		"is_anonymous": member.Anonymous,
	}
	embedRights(params, member.Rights)

	_, err := b.Raw("promoteChatMember", params)
	return err
}

// AdminsOf returns a member list of chat admins.
//
// On success, returns an Array of ChatMember objects that
// contains information about all chat administrators except other bots.
//
// If the chat is a group or a supergroup and
// no administrators were appointed, only the creator will be returned.
func (b *Bot) AdminsOf(chat *Chat) ([]ChatMember, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	data, err := b.Raw("getChatAdministrators", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result []ChatMember
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// Len returns the number of members in a chat.
func (b *Bot) Len(chat *Chat) (int, error) {
	params := map[string]string{
		"chat_id": chat.Recipient(),
	}

	data, err := b.Raw("getChatMembersCount", params)
	if err != nil {
		return 0, err
	}

	var resp struct {
		Result int
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return 0, wrapError(err)
	}
	return resp.Result, nil
}

// SetAdminTitle sets a custom title for an administrator.
// A title should be 0-16 characters length, emoji are not allowed.
func (b *Bot) SetAdminTitle(chat *Chat, user *User, title string) error {
	params := map[string]string{
		"chat_id":      chat.Recipient(),
		"user_id":      user.Recipient(),
		"custom_title": title,
	}

	_, err := b.Raw("setChatAdministratorCustomTitle", params)
	return err
}

// BanSenderChat will use this method to ban a channel chat in a supergroup or a channel.
// Until the chat is unbanned, the owner of the banned chat won't be able
// to send messages on behalf of any of their channels.
func (b *Bot) BanSenderChat(chat *Chat, sender Recipient) error {
	params := map[string]string{
		"chat_id":        chat.Recipient(),
		"sender_chat_id": sender.Recipient(),
	}

	_, err := b.Raw("banChatSenderChat", params)
	return err
}

// UnbanSenderChat will use this method to unban a previously banned channel chat in a supergroup or channel.
// The bot must be an administrator for this to work and must have the appropriate administrator rights.
func (b *Bot) UnbanSenderChat(chat *Chat, sender Recipient) error {
	params := map[string]string{
		"chat_id":        chat.Recipient(),
		"sender_chat_id": sender.Recipient(),
	}

	_, err := b.Raw("unbanChatSenderChat", params)
	return err
}

// DefaultRights returns the current default administrator rights of the bot.
func (b *Bot) DefaultRights(forChannels bool) (*Rights, error) {
	params := map[string]bool{
		"for_channels": forChannels,
	}

	data, err := b.Raw("getMyDefaultAdministratorRights", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result *Rights
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// SetDefaultRights changes the default administrator rights requested by the bot
// when it's added as an administrator to groups or channels.
func (b *Bot) SetDefaultRights(rights Rights, forChannels bool) error {
	params := map[string]interface{}{
		"rights":       rights,
		"for_channels": forChannels,
	}

	_, err := b.Raw("setMyDefaultAdministratorRights", params)
	return err
}

func embedRights(p map[string]interface{}, rights Rights) {
	data, _ := json.Marshal(rights)
	_ = json.Unmarshal(data, &p)
}
