package jsonmessage // import "github.com/docker/docker/pkg/jsonmessage"

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/go-units"
	"github.com/moby/term"
	"github.com/morikuni/aec"
)

// RFC3339NanoFixed is time.RFC3339Nano with nanoseconds padded using zeros to
// ensure the formatted time isalways the same number of characters.
const RFC3339NanoFixed = "2006-01-02T15:04:05.000000000Z07:00"

// JSONError wraps a concrete Code and Message, Code is
// an integer error code, Message is the error message.
type JSONError struct {
	Code    int    `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
}

func (e *JSONError) Error() string {
	return e.Message
}

// JSONProgress describes a progress message in a JSON stream.
type JSONProgress struct {
	// Current is the current status and value of the progress made towards Total.
	Current int64 `json:"current,omitempty"`
	// Total is the end value describing when we made 100% progress for an operation.
	Total int64 `json:"total,omitempty"`
	// Start is the initial value for the operation.
	Start int64 `json:"start,omitempty"`
	// HideCounts. if true, hides the progress count indicator (xB/yB).
	HideCounts bool `json:"hidecounts,omitempty"`
	// Units is the unit to print for progress. It defaults to "bytes" if empty.
	Units string `json:"units,omitempty"`

	// terminalFd is the fd of the current terminal, if any. It is used
	// to get the terminal width.
	terminalFd uintptr

	// nowFunc is used to override the current time in tests.
	nowFunc func() time.Time

	// winSize is used to override the terminal width in tests.
	winSize int
}

func (p *JSONProgress) String() string {
	var (
		width      = p.width()
		pbBox      string
		numbersBox string
	)
	if p.Current <= 0 && p.Total <= 0 {
		return ""
	}
	if p.Total <= 0 {
		switch p.Units {
		case "":
			return fmt.Sprintf("%8v", units.HumanSize(float64(p.Current)))
		default:
			return fmt.Sprintf("%d %s", p.Current, p.Units)
		}
	}

	percentage := int(float64(p.Current)/float64(p.Total)*100) / 2
	if percentage > 50 {
		percentage = 50
	}
	if width > 110 {
		// this number can't be negative gh#7136
		numSpaces := 0
		if 50-percentage > 0 {
			numSpaces = 50 - percentage
		}
		pbBox = fmt.Sprintf("[%s>%s] ", strings.Repeat("=", percentage), strings.Repeat(" ", numSpaces))
	}

	switch {
	case p.HideCounts:
	case p.Units == "": // no units, use bytes
		current := units.HumanSize(float64(p.Current))
		total := units.HumanSize(float64(p.Total))

		numbersBox = fmt.Sprintf("%8v/%v", current, total)

		if p.Current > p.Total {
			// remove total display if the reported current is wonky.
			numbersBox = fmt.Sprintf("%8v", current)
		}
	default:
		numbersBox = fmt.Sprintf("%d/%d %s", p.Current, p.Total, p.Units)

		if p.Current > p.Total {
			// remove total display if the reported current is wonky.
			numbersBox = fmt.Sprintf("%d %s", p.Current, p.Units)
		}
	}

	// Show approximation of remaining time if there's enough width.
	var timeLeftBox string
	if width > 50 {
		if p.Current > 0 && p.Start > 0 && percentage < 50 {
			fromStart := p.now().Sub(time.Unix(p.Start, 0))
			perEntry := fromStart / time.Duration(p.Current)
			left := time.Duration(p.Total-p.Current) * perEntry
			timeLeftBox = " " + left.Round(time.Second).String()
		}
	}
	return pbBox + numbersBox + timeLeftBox
}

// now returns the current time in UTC, but can be overridden in tests
// by setting JSONProgress.nowFunc to a custom function.
func (p *JSONProgress) now() time.Time {
	if p.nowFunc != nil {
		return p.nowFunc()
	}
	return time.Now().UTC()
}

// width returns the current terminal's width, but can be overridden
// in tests by setting JSONProgress.winSize to a non-zero value.
func (p *JSONProgress) width() int {
	if p.winSize != 0 {
		return p.winSize
	}
	ws, err := term.GetWinsize(p.terminalFd)
	if err == nil {
		return int(ws.Width)
	}
	return 200
}

// JSONMessage defines a message struct. It describes
// the created time, where it from, status, ID of the
// message. It's used for docker events.
type JSONMessage struct {
	Stream   string        `json:"stream,omitempty"`
	Status   string        `json:"status,omitempty"`
	Progress *JSONProgress `json:"progressDetail,omitempty"`

	// ProgressMessage is a pre-formatted presentation of [Progress].
	//
	// Deprecated: this field is deprecated since docker v0.7.1 / API v1.8. Use the information in [Progress] instead. This field will be omitted in a future release.
	ProgressMessage string     `json:"progress,omitempty"`
	ID              string     `json:"id,omitempty"`
	From            string     `json:"from,omitempty"`
	Time            int64      `json:"time,omitempty"`
	TimeNano        int64      `json:"timeNano,omitempty"`
	Error           *JSONError `json:"errorDetail,omitempty"`

	// ErrorMessage contains errors encountered during the operation.
	//
	// Deprecated: this field is deprecated since docker v0.6.0 / API v1.4. Use [Error.Message] instead. This field will be omitted in a future release.
	ErrorMessage string `json:"error,omitempty"` // deprecated
	// Aux contains out-of-band data, such as digests for push signing and image id after building.
	Aux *json.RawMessage `json:"aux,omitempty"`
}

func clearLine(out io.Writer) {
	eraseMode := aec.EraseModes.All
	cl := aec.EraseLine(eraseMode)
	fmt.Fprint(out, cl)
}

func cursorUp(out io.Writer, l uint) {
	fmt.Fprint(out, aec.Up(l))
}

func cursorDown(out io.Writer, l uint) {
	fmt.Fprint(out, aec.Down(l))
}

// Display prints the JSONMessage to out. If isTerminal is true, it erases
// the entire current line when displaying the progressbar. It returns an
// error if the [JSONMessage.Error] field is non-nil.
func (jm *JSONMessage) Display(out io.Writer, isTerminal bool) error {
	if jm.Error != nil {
		return jm.Error
	}
	var endl string
	if isTerminal && jm.Stream == "" && jm.Progress != nil {
		clearLine(out)
		endl = "\r"
		fmt.Fprint(out, endl)
	} else if jm.Progress != nil && jm.Progress.String() != "" { // disable progressbar in non-terminal
		return nil
	}
	if jm.TimeNano != 0 {
		fmt.Fprintf(out, "%s ", time.Unix(0, jm.TimeNano).Format(RFC3339NanoFixed))
	} else if jm.Time != 0 {
		fmt.Fprintf(out, "%s ", time.Unix(jm.Time, 0).Format(RFC3339NanoFixed))
	}
	if jm.ID != "" {
		fmt.Fprintf(out, "%s: ", jm.ID)
	}
	if jm.From != "" {
		fmt.Fprintf(out, "(from %s) ", jm.From)
	}
	if jm.Progress != nil && isTerminal {
		fmt.Fprintf(out, "%s %s%s", jm.Status, jm.Progress.String(), endl)
	} else if jm.ProgressMessage != "" { // deprecated
		fmt.Fprintf(out, "%s %s%s", jm.Status, jm.ProgressMessage, endl)
	} else if jm.Stream != "" {
		fmt.Fprintf(out, "%s%s", jm.Stream, endl)
	} else {
		fmt.Fprintf(out, "%s%s\n", jm.Status, endl)
	}
	return nil
}

// DisplayJSONMessagesStream reads a JSON message stream from in, and writes
// each [JSONMessage] to out. It returns an error if an invalid JSONMessage
// is received, or if a JSONMessage containers a non-zero [JSONMessage.Error].
//
// Presentation of the JSONMessage depends on whether a terminal is attached,
// and on the terminal width. Progress bars ([JSONProgress]) are suppressed
// on narrower terminals (< 110 characters).
//
//   - isTerminal describes if out is a terminal, in which case it prints
//     a newline ("\n") at the end of each line and moves the cursor while
//     displaying.
//   - terminalFd is the fd of the current terminal (if any), and used
//     to get the terminal width.
//   - auxCallback allows handling the [JSONMessage.Aux] field. It is
//     called if a JSONMessage contains an Aux field, in which case
//     DisplayJSONMessagesStream does not present the JSONMessage.
func DisplayJSONMessagesStream(in io.Reader, out io.Writer, terminalFd uintptr, isTerminal bool, auxCallback func(JSONMessage)) error {
	var (
		dec = json.NewDecoder(in)
		ids = make(map[string]uint)
	)

	for {
		var diff uint
		var jm JSONMessage
		if err := dec.Decode(&jm); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		if jm.Aux != nil {
			if auxCallback != nil {
				auxCallback(jm)
			}
			continue
		}

		if jm.Progress != nil {
			jm.Progress.terminalFd = terminalFd
		}
		if jm.ID != "" && (jm.Progress != nil || jm.ProgressMessage != "") {
			line, ok := ids[jm.ID]
			if !ok {
				// NOTE: This approach of using len(id) to
				// figure out the number of lines of history
				// only works as long as we clear the history
				// when we output something that's not
				// accounted for in the map, such as a line
				// with no ID.
				line = uint(len(ids))
				ids[jm.ID] = line
				if isTerminal {
					fmt.Fprintf(out, "\n")
				}
			}
			diff = uint(len(ids)) - line
			if isTerminal {
				cursorUp(out, diff)
			}
		} else {
			// When outputting something that isn't progress
			// output, clear the history of previous lines. We
			// don't want progress entries from some previous
			// operation to be updated (for example, pull -a
			// with multiple tags).
			ids = make(map[string]uint)
		}
		err := jm.Display(out, isTerminal)
		if jm.ID != "" && isTerminal {
			cursorDown(out, diff)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// Stream is an io.Writer for output with utilities to get the output's file
// descriptor and to detect whether it's a terminal.
//
// it is subset of the streams.Out type in
// https://pkg.go.dev/github.com/docker/cli@v20.10.17+incompatible/cli/streams#Out
type Stream interface {
	io.Writer
	FD() uintptr
	IsTerminal() bool
}

// DisplayJSONMessagesToStream prints json messages to the output Stream. It is
// used by the Docker CLI to print JSONMessage streams.
func DisplayJSONMessagesToStream(in io.Reader, stream Stream, auxCallback func(JSONMessage)) error {
	return DisplayJSONMessagesStream(in, stream, stream.FD(), stream.IsTerminal(), auxCallback)
}
