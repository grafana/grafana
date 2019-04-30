// Package kb provides keyboard mappings for Chrome DOM Keys for use with input
// events.
package kb

//go:generate go run gen.go -out keys.go -pkg kb

import (
	"runtime"
	"unicode"

	"github.com/chromedp/cdproto/input"
)

// Key contains information for generating a key press based off the unicode
// value.
//
// Example data for the following runes:
// 									'\r'  '\n'  | ','  '<'    | 'a'   'A'  | '\u0a07'
// 									_____________________________________________________
type Key struct {
	// Code is the key code:
	// 								"Enter"     | "Comma"     | "KeyA"     | "MediaStop"
	Code string

	// Key is the key value:
	// 								"Enter"     | ","   "<"   | "a"   "A"  | "MediaStop"
	Key string

	// Text is the text for printable keys:
	// 								"\r"  "\r"  | ","   "<"   | "a"   "A"  | ""
	Text string

	// Unmodified is the unmodified text for printable keys:
	// 								"\r"  "\r"  | ","   ","   | "a"   "a"  | ""
	Unmodified string

	// Native is the native scan code.
	// 								0x13  0x13  | 0xbc  0xbc  | 0x61  0x41 | 0x00ae
	Native int64

	// Windows is the windows scan code.
	// 								0x13  0x13  | 0xbc  0xbc  | 0x61  0x41 | 0xe024
	Windows int64

	// Shift indicates whether or not the Shift modifier should be sent.
	// 								false false | false true  | false true | false
	Shift bool

	// Print indicates whether or not the character is a printable character
	// (ie, should a "char" event be generated).
	// 								true  true  | true  true  | true  true | false
	Print bool
}

// EncodeUnidentified encodes a keyDown, char, and keyUp sequence for an unidentified rune.
//
// TODO: write unit tests for non-latin/ascii unicode characters.
func EncodeUnidentified(r rune) []*input.DispatchKeyEventParams {
	// create
	keyDown := input.DispatchKeyEventParams{
		Key: "Unidentified",
		/*NativeVirtualKeyCode:  int64(r), // not sure if should be specifying the key code or not ...
		WindowsVirtualKeyCode: int64(r),*/
	}
	keyUp := keyDown
	keyDown.Type, keyUp.Type = input.KeyDown, input.KeyUp

	// printable, so create char event
	if unicode.IsPrint(r) {
		keyChar := keyDown
		keyChar.Type = input.KeyChar
		keyChar.Text = string(r)
		keyChar.UnmodifiedText = string(r)

		return []*input.DispatchKeyEventParams{&keyDown, &keyChar, &keyUp}
	}

	return []*input.DispatchKeyEventParams{&keyDown, &keyUp}
}

// Encode encodes a keyDown, char, and keyUp sequence for the specified rune.
func Encode(r rune) []*input.DispatchKeyEventParams {
	// force \n -> \r
	if r == '\n' {
		r = '\r'
	}

	// if not known key, encode as unidentified
	v, ok := Keys[r]
	if !ok {
		return EncodeUnidentified(r)
	}

	// create
	keyDown := input.DispatchKeyEventParams{
		Key:                   v.Key,
		Code:                  v.Code,
		NativeVirtualKeyCode:  v.Native,
		WindowsVirtualKeyCode: v.Windows,
	}
	if runtime.GOOS == "darwin" {
		keyDown.NativeVirtualKeyCode = 0
	}
	if v.Shift {
		keyDown.Modifiers |= input.ModifierShift
	}
	keyUp := keyDown
	keyDown.Type, keyUp.Type = input.KeyDown, input.KeyUp

	// printable, so create char event
	if v.Print {
		keyChar := keyDown
		keyChar.Type = input.KeyChar
		keyChar.Text = v.Text
		keyChar.UnmodifiedText = v.Unmodified

		// the virtual key code for char events for printable characters will
		// be different than the defined keycode when not shifted...
		//
		// specifically, it always sends the ascii value as the scan code,
		// which is available as the rune.
		keyChar.NativeVirtualKeyCode = int64(r)
		keyChar.WindowsVirtualKeyCode = int64(r)

		return []*input.DispatchKeyEventParams{&keyDown, &keyChar, &keyUp}
	}

	return []*input.DispatchKeyEventParams{&keyDown, &keyUp}
}
