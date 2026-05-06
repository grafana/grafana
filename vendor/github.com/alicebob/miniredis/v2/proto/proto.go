package proto

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

var (
	ErrProtocol   = errors.New("unsupported protocol")
	ErrUnexpected = errors.New("not what you asked for")
)

func readLine(r *bufio.Reader) (string, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return "", err
	}
	if len(line) < 3 {
		return "", ErrProtocol
	}
	return line, nil
}

// Read an array, with all elements are the raw redis commands
// Also reads sets and maps.
func ReadArray(b string) ([]string, error) {
	r := bufio.NewReader(strings.NewReader(b))
	line, err := readLine(r)
	if err != nil {
		return nil, err
	}

	elems := 0
	switch line[0] {
	default:
		return nil, ErrUnexpected
	case '*', '>', '~':
		// *: array
		// >: push data
		// ~: set
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return nil, err
		}
		elems = length
	case '%':
		// we also read maps.
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return nil, err
		}
		elems = length * 2
	}

	var res []string
	for i := 0; i < elems; i++ {
		next, err := Read(r)
		if err != nil {
			return nil, err
		}
		res = append(res, next)
	}
	return res, nil
}

func ReadString(b string) (string, error) {
	r := bufio.NewReader(strings.NewReader(b))
	line, err := readLine(r)
	if err != nil {
		return "", err
	}

	switch line[0] {
	default:
		return "", ErrUnexpected
	case '$':
		// bulk strings are: `$5\r\nhello\r\n`
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return "", err
		}
		if length < 0 {
			// -1 is a nil response
			return line, nil
		}
		var (
			buf = make([]byte, length+2)
			pos = 0
		)
		for pos < length+2 {
			n, err := r.Read(buf[pos:])
			if err != nil {
				return "", err
			}
			pos += n
		}
		return string(buf[:len(buf)-2]), nil
	}
}

func readInline(b string) (string, error) {
	if len(b) < 3 {
		return "", ErrUnexpected
	}
	return b[1 : len(b)-2], nil
}

func ReadError(b string) (string, error) {
	if len(b) < 1 {
		return "", ErrUnexpected
	}

	switch b[0] {
	default:
		return "", ErrUnexpected
	case '-':
		return readInline(b)
	}
}

func ReadStrings(b string) ([]string, error) {
	elems, err := ReadArray(b)
	if err != nil {
		return nil, err
	}
	var res []string
	for _, e := range elems {
		s, err := ReadString(e)
		if err != nil {
			return nil, err
		}
		res = append(res, s)
	}
	return res, nil
}

// Read a single command, returning it raw. Used to read replies from redis.
// Understands RESP3 proto.
func Read(r *bufio.Reader) (string, error) {
	line, err := readLine(r)
	if err != nil {
		return "", err
	}

	switch line[0] {
	default:
		return "", ErrProtocol
	case '+', '-', ':', ',', '_':
		// +: inline string
		// -: errors
		// :: integer
		// ,: float
		// _: null
		// Simple line based replies.
		return line, nil
	case '$':
		// bulk strings are: `$5\r\nhello\r\n`
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return "", err
		}
		if length < 0 {
			// -1 is a nil response
			return line, nil
		}
		var (
			buf = make([]byte, length+2)
			pos = 0
		)
		for pos < length+2 {
			n, err := r.Read(buf[pos:])
			if err != nil {
				return "", err
			}
			pos += n
		}
		return line + string(buf), nil
	case '*', '>', '~':
		// arrays are: `*6\r\n...`
		// pushdata is: `>6\r\n...`
		// sets are: `~6\r\n...`
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return "", err
		}
		for i := 0; i < length; i++ {
			next, err := Read(r)
			if err != nil {
				return "", err
			}
			line += next
		}
		return line, nil
	case '%':
		// maps are: `%3\r\n...`
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return "", err
		}
		for i := 0; i < length*2; i++ {
			next, err := Read(r)
			if err != nil {
				return "", err
			}
			line += next
		}
		return line, nil
	}
}

// Write a command in RESP3 proto. Used to write commands to redis.
// Currently only supports string arrays.
func Write(w io.Writer, cmd []string) error {
	if _, err := fmt.Fprintf(w, "*%d\r\n", len(cmd)); err != nil {
		return err
	}
	for _, c := range cmd {
		if _, err := fmt.Fprintf(w, "$%d\r\n%s\r\n", len(c), c); err != nil {
			return err
		}
	}
	return nil
}

// Parse into interfaces. `b` must contain exactly a single command (which can be nested).
func Parse(b string) (interface{}, error) {
	if len(b) < 1 {
		return nil, ErrUnexpected
	}

	switch b[0] {
	default:
		return "", ErrProtocol
	case '+':
		return readInline(b)
	case '-':
		e, err := readInline(b)
		if err != nil {
			return nil, err
		}
		return errors.New(e), nil
	case ':':
		e, err := readInline(b)
		if err != nil {
			return nil, err
		}
		return strconv.Atoi(e)
	case '$':
		return ReadString(b)
	case '*':
		elems, err := ReadArray(b)
		if err != nil {
			return nil, err
		}
		var res []interface{}
		for _, elem := range elems {
			e, err := Parse(elem)
			if err != nil {
				return nil, err
			}
			res = append(res, e)
		}
		return res, nil
	case '%':
		elems, err := ReadArray(b)
		if err != nil {
			return nil, err
		}
		var res = map[interface{}]interface{}{}
		for len(elems) > 1 {
			key, err := Parse(elems[0])
			if err != nil {
				return nil, err
			}
			value, err := Parse(elems[1])
			if err != nil {
				return nil, err
			}
			res[key] = value
			elems = elems[2:]
		}
		return res, nil
	}
}
