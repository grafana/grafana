package telebot

import (
	"errors"
	"fmt"
	"strings"
)

type (
	Error struct {
		Code        int
		Description string
		Message     string
	}

	FloodError struct {
		err        *Error
		RetryAfter int
	}

	GroupError struct {
		err        *Error
		MigratedTo int64
	}
)

// ʔ returns description of error.
// A tiny shortcut to make code clearer.
func (err *Error) ʔ() string {
	return err.Description
}

// Error implements error interface.
func (err *Error) Error() string {
	msg := err.Message
	if msg == "" {
		split := strings.Split(err.Description, ": ")
		if len(split) == 2 {
			msg = split[1]
		} else {
			msg = err.Description
		}
	}
	return fmt.Sprintf("telegram: %s (%d)", msg, err.Code)
}

// Error implements error interface.
func (err FloodError) Error() string {
	return err.err.Error()
}

// Error implements error interface.
func (err GroupError) Error() string {
	return err.err.Error()
}

// NewError returns new Error instance with given description.
// First element of msgs is Description. The second is optional Message.
func NewError(code int, msgs ...string) *Error {
	err := &Error{Code: code}
	if len(msgs) >= 1 {
		err.Description = msgs[0]
	}
	if len(msgs) >= 2 {
		err.Message = msgs[1]
	}
	return err
}

// General errors
var (
	ErrTooLarge     = NewError(400, "Request Entity Too Large")
	ErrUnauthorized = NewError(401, "Unauthorized")
	ErrNotFound     = NewError(404, "Not Found")
	ErrInternal     = NewError(500, "Internal Server Error")
)

// Bad request errors
var (
	ErrBadButtonData          = NewError(400, "Bad Request: BUTTON_DATA_INVALID")
	ErrBadUserID              = NewError(400, "Bad Request: USER_ID_INVALID")
	ErrBadPollOptions         = NewError(400, "Bad Request: expected an Array of String as options")
	ErrBadURLContent          = NewError(400, "Bad Request: failed to get HTTP URL content")
	ErrCantEditMessage        = NewError(400, "Bad Request: message can't be edited")
	ErrCantRemoveOwner        = NewError(400, "Bad Request: can't remove chat owner")
	ErrCantUploadFile         = NewError(400, "Bad Request: can't upload file by URL")
	ErrCantUseMediaInAlbum    = NewError(400, "Bad Request: can't use the media of the specified type in the album")
	ErrChatAboutNotModified   = NewError(400, "Bad Request: chat description is not modified")
	ErrChatNotFound           = NewError(400, "Bad Request: chat not found")
	ErrEmptyChatID            = NewError(400, "Bad Request: chat_id is empty")
	ErrEmptyMessage           = NewError(400, "Bad Request: message must be non-empty")
	ErrEmptyText              = NewError(400, "Bad Request: text is empty")
	ErrFailedImageProcess     = NewError(400, "Bad Request: IMAGE_PROCESS_FAILED", "Image process failed")
	ErrGroupMigrated          = NewError(400, "Bad Request: group chat was upgraded to a supergroup chat")
	ErrMessageNotModified     = NewError(400, "Bad Request: message is not modified")
	ErrNoRightsToDelete       = NewError(400, "Bad Request: message can't be deleted")
	ErrNoRightsToRestrict     = NewError(400, "Bad Request: not enough rights to restrict/unrestrict chat member")
	ErrNoRightsToSend         = NewError(400, "Bad Request: have no rights to send a message")
	ErrNoRightsToSendGifs     = NewError(400, "Bad Request: CHAT_SEND_GIFS_FORBIDDEN", "sending GIFS is not allowed in this chat")
	ErrNoRightsToSendPhoto    = NewError(400, "Bad Request: not enough rights to send photos to the chat")
	ErrNoRightsToSendStickers = NewError(400, "Bad Request: not enough rights to send stickers to the chat")
	ErrNotFoundToDelete       = NewError(400, "Bad Request: message to delete not found")
	ErrNotFoundToForward      = NewError(400, "Bad Request: message to forward not found")
	ErrNotFoundToReply        = NewError(400, "Bad Request: reply message not found")
	ErrQueryTooOld            = NewError(400, "Bad Request: query is too old and response timeout expired or query ID is invalid")
	ErrSameMessageContent     = NewError(400, "Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message")
	ErrStickerEmojisInvalid   = NewError(400, "Bad Request: invalid sticker emojis")
	ErrStickerSetInvalid      = NewError(400, "Bad Request: STICKERSET_INVALID", "Stickerset is invalid")
	ErrStickerSetInvalidName  = NewError(400, "Bad Request: invalid sticker set name is specified")
	ErrStickerSetNameOccupied = NewError(400, "Bad Request: sticker set name is already occupied")
	ErrTooLongMarkup          = NewError(400, "Bad Request: reply markup is too long")
	ErrTooLongMessage         = NewError(400, "Bad Request: message is too long")
	ErrUserIsAdmin            = NewError(400, "Bad Request: user is an administrator of the chat")
	ErrWrongFileID            = NewError(400, "Bad Request: wrong file identifier/HTTP URL specified")
	ErrWrongFileIDCharacter   = NewError(400, "Bad Request: wrong remote file id specified: Wrong character in the string")
	ErrWrongFileIDLength      = NewError(400, "Bad Request: wrong remote file id specified: Wrong string length")
	ErrWrongFileIDPadding     = NewError(400, "Bad Request: wrong remote file id specified: Wrong padding in the string")
	ErrWrongFileIDSymbol      = NewError(400, "Bad Request: wrong remote file id specified: can't unserialize it. Wrong last symbol")
	ErrWrongTypeOfContent     = NewError(400, "Bad Request: wrong type of the web page content")
	ErrWrongURL               = NewError(400, "Bad Request: wrong HTTP URL specified")
	ErrForwardMessage         = NewError(400, "Bad Request: administrators of the chat restricted message forwarding")
	ErrUserAlreadyParticipant = NewError(400, "Bad Request: USER_ALREADY_PARTICIPANT", "User is already a participant")
	ErrHideRequesterMissing   = NewError(400, "Bad Request: HIDE_REQUESTER_MISSING")
	ErrChannelsTooMuch        = NewError(400, "Bad Request: CHANNELS_TOO_MUCH")
	ErrChannelsTooMuchUser    = NewError(400, "Bad Request: USER_CHANNELS_TOO_MUCH")
)

// Forbidden errors
var (
	ErrBlockedByUser        = NewError(403, "Forbidden: bot was blocked by the user")
	ErrKickedFromGroup      = NewError(403, "Forbidden: bot was kicked from the group chat")
	ErrKickedFromSuperGroup = NewError(403, "Forbidden: bot was kicked from the supergroup chat")
	ErrKickedFromChannel    = NewError(403, "Forbidden: bot was kicked from the channel chat")
	ErrNotStartedByUser     = NewError(403, "Forbidden: bot can't initiate conversation with a user")
	ErrUserIsDeactivated    = NewError(403, "Forbidden: user is deactivated")
	ErrNotChannelMember     = NewError(403, "Forbidden: bot is not a member of the channel chat")
)

// Err returns Error instance by given description.
func Err(s string) error {
	switch s {
	case ErrTooLarge.ʔ():
		return ErrTooLarge
	case ErrUnauthorized.ʔ():
		return ErrUnauthorized
	case ErrNotFound.ʔ():
		return ErrNotFound
	case ErrInternal.ʔ():
		return ErrInternal
	case ErrBadButtonData.ʔ():
		return ErrBadButtonData
	case ErrBadUserID.ʔ():
		return ErrBadUserID
	case ErrBadPollOptions.ʔ():
		return ErrBadPollOptions
	case ErrBadURLContent.ʔ():
		return ErrBadURLContent
	case ErrCantEditMessage.ʔ():
		return ErrCantEditMessage
	case ErrCantRemoveOwner.ʔ():
		return ErrCantRemoveOwner
	case ErrCantUploadFile.ʔ():
		return ErrCantUploadFile
	case ErrCantUseMediaInAlbum.ʔ():
		return ErrCantUseMediaInAlbum
	case ErrChatAboutNotModified.ʔ():
		return ErrChatAboutNotModified
	case ErrChatNotFound.ʔ():
		return ErrChatNotFound
	case ErrEmptyChatID.ʔ():
		return ErrEmptyChatID
	case ErrEmptyMessage.ʔ():
		return ErrEmptyMessage
	case ErrEmptyText.ʔ():
		return ErrEmptyText
	case ErrFailedImageProcess.ʔ():
		return ErrFailedImageProcess
	case ErrGroupMigrated.ʔ():
		return ErrGroupMigrated
	case ErrMessageNotModified.ʔ():
		return ErrMessageNotModified
	case ErrNoRightsToDelete.ʔ():
		return ErrNoRightsToDelete
	case ErrNoRightsToRestrict.ʔ():
		return ErrNoRightsToRestrict
	case ErrNoRightsToSend.ʔ():
		return ErrNoRightsToSend
	case ErrNoRightsToSendGifs.ʔ():
		return ErrNoRightsToSendGifs
	case ErrNoRightsToSendPhoto.ʔ():
		return ErrNoRightsToSendPhoto
	case ErrNoRightsToSendStickers.ʔ():
		return ErrNoRightsToSendStickers
	case ErrNotFoundToDelete.ʔ():
		return ErrNotFoundToDelete
	case ErrNotFoundToForward.ʔ():
		return ErrNotFoundToForward
	case ErrNotFoundToReply.ʔ():
		return ErrNotFoundToReply
	case ErrQueryTooOld.ʔ():
		return ErrQueryTooOld
	case ErrSameMessageContent.ʔ():
		return ErrSameMessageContent
	case ErrStickerEmojisInvalid.ʔ():
		return ErrStickerEmojisInvalid
	case ErrStickerSetInvalid.ʔ():
		return ErrStickerSetInvalid
	case ErrStickerSetInvalidName.ʔ():
		return ErrStickerSetInvalidName
	case ErrStickerSetNameOccupied.ʔ():
		return ErrStickerSetNameOccupied
	case ErrTooLongMarkup.ʔ():
		return ErrTooLongMarkup
	case ErrTooLongMessage.ʔ():
		return ErrTooLongMessage
	case ErrUserIsAdmin.ʔ():
		return ErrUserIsAdmin
	case ErrWrongFileID.ʔ():
		return ErrWrongFileID
	case ErrWrongFileIDCharacter.ʔ():
		return ErrWrongFileIDCharacter
	case ErrWrongFileIDLength.ʔ():
		return ErrWrongFileIDLength
	case ErrWrongFileIDPadding.ʔ():
		return ErrWrongFileIDPadding
	case ErrWrongFileIDSymbol.ʔ():
		return ErrWrongFileIDSymbol
	case ErrWrongTypeOfContent.ʔ():
		return ErrWrongTypeOfContent
	case ErrWrongURL.ʔ():
		return ErrWrongURL
	case ErrBlockedByUser.ʔ():
		return ErrBlockedByUser
	case ErrKickedFromGroup.ʔ():
		return ErrKickedFromGroup
	case ErrKickedFromSuperGroup.ʔ():
		return ErrKickedFromSuperGroup
	case ErrKickedFromChannel.ʔ():
		return ErrKickedFromChannel
	case ErrNotStartedByUser.ʔ():
		return ErrNotStartedByUser
	case ErrUserIsDeactivated.ʔ():
		return ErrUserIsDeactivated
	case ErrForwardMessage.ʔ():
		return ErrForwardMessage
	case ErrUserAlreadyParticipant.ʔ():
		return ErrUserAlreadyParticipant
	case ErrHideRequesterMissing.ʔ():
		return ErrHideRequesterMissing
	case ErrChannelsTooMuch.ʔ():
		return ErrChannelsTooMuch
	case ErrChannelsTooMuchUser.ʔ():
		return ErrChannelsTooMuchUser
	case ErrNotChannelMember.ʔ():
		return ErrNotChannelMember
	default:
		return nil
	}
}

// ErrIs checks if the error with given description matches an error err.
func ErrIs(s string, err error) bool {
	return errors.Is(err, Err(s))
}

// wrapError returns new wrapped telebot-related error.
func wrapError(err error) error {
	return fmt.Errorf("telebot: %w", err)
}
