package telebot

import "encoding/json"

// Command represents a bot command.
type Command struct {
	// Text is a text of the command, 1-32 characters.
	// Can contain only lowercase English letters, digits and underscores.
	Text string `json:"command"`

	// Description of the command, 3-256 characters.
	Description string `json:"description"`
}

// CommandParams controls parameters for commands-related methods (setMyCommands, deleteMyCommands and getMyCommands).
type CommandParams struct {
	Commands     []Command     `json:"commands,omitempty"`
	Scope        *CommandScope `json:"scope,omitempty"`
	LanguageCode string        `json:"language_code,omitempty"`
}

type CommandScopeType = string

const (
	CommandScopeDefault         CommandScopeType = "default"
	CommandScopeAllPrivateChats CommandScopeType = "all_private_chats"
	CommandScopeAllGroupChats   CommandScopeType = "all_group_chats"
	CommandScopeAllChatAdmin    CommandScopeType = "all_chat_administrators"
	CommandScopeChat            CommandScopeType = "chat"
	CommandScopeChatAdmin       CommandScopeType = "chat_administrators"
	CommandScopeChatMember      CommandScopeType = "chat_member"
)

// CommandScope object represents a scope to which bot commands are applied.
type CommandScope struct {
	Type   CommandScopeType `json:"type"`
	ChatID int64            `json:"chat_id,omitempty"`
	UserID int64            `json:"user_id,omitempty"`
}

// Commands returns the current list of the bot's commands for the given scope and user language.
func (b *Bot) Commands(opts ...interface{}) ([]Command, error) {
	params := extractCommandsParams(opts...)
	data, err := b.Raw("getMyCommands", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result []Command
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, wrapError(err)
	}
	return resp.Result, nil
}

// SetCommands changes the list of the bot's commands.
func (b *Bot) SetCommands(opts ...interface{}) error {
	params := extractCommandsParams(opts...)
	_, err := b.Raw("setMyCommands", params)
	return err
}

// DeleteCommands deletes the list of the bot's commands for the given scope and user language.
func (b *Bot) DeleteCommands(opts ...interface{}) error {
	params := extractCommandsParams(opts...)
	_, err := b.Raw("deleteMyCommands", params)
	return err
}

// extractCommandsParams extracts parameters for commands-related methods from the given options.
func extractCommandsParams(opts ...interface{}) (params CommandParams) {
	for _, opt := range opts {
		switch value := opt.(type) {
		case []Command:
			params.Commands = value
		case string:
			params.LanguageCode = value
		case CommandScope:
			params.Scope = &value
		}
	}
	return
}
