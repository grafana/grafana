package server

import (
	"bufio"
	"errors"
	"strconv"
)

type Simple string

// ErrProtocol is the general error for unexpected input
var ErrProtocol = errors.New("invalid request")

// client always sends arrays with bulk strings
func readArray(rd *bufio.Reader) ([]string, error) {
	line, err := rd.ReadString('\n')
	if err != nil {
		return nil, err
	}
	if len(line) < 3 {
		return nil, ErrProtocol
	}

	switch line[0] {
	default:
		return nil, ErrProtocol
	case '*':
		l, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return nil, err
		}
		// l can be -1
		var fields []string
		for ; l > 0; l-- {
			s, err := readString(rd)
			if err != nil {
				return nil, err
			}
			fields = append(fields, s)
		}
		return fields, nil
	}
}

func readString(rd *bufio.Reader) (string, error) {
	line, err := rd.ReadString('\n')
	if err != nil {
		return "", err
	}
	if len(line) < 3 {
		return "", ErrProtocol
	}

	switch line[0] {
	default:
		return "", ErrProtocol
	case '+', '-', ':':
		// +: simple string
		// -: errors
		// :: integer
		// Simple line based replies.
		return string(line[1 : len(line)-2]), nil
	case '$':
		// bulk strings are: `$5\r\nhello\r\n`
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return "", err
		}
		if length < 0 {
			// -1 is a nil response
			return "", nil
		}
		var (
			buf = make([]byte, length+2)
			pos = 0
		)
		for pos < length+2 {
			n, err := rd.Read(buf[pos:])
			if err != nil {
				return "", err
			}
			pos += n
		}
		return string(buf[:length]), nil
	}
}

// parse a reply
func ParseReply(rd *bufio.Reader) (interface{}, error) {
	line, err := rd.ReadString('\n')
	if err != nil {
		return nil, err
	}
	if len(line) < 3 {
		return nil, ErrProtocol
	}

	switch line[0] {
	default:
		return nil, ErrProtocol
	case '+':
		// +: simple string
		return Simple(line[1 : len(line)-2]), nil
	case '-':
		// -: errors
		return nil, errors.New(string(line[1 : len(line)-2]))
	case ':':
		// :: integer
		v := line[1 : len(line)-2]
		if v == "" {
			return 0, nil
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, ErrProtocol
		}
		return n, nil
	case '$':
		// bulk strings are: `$5\r\nhello\r\n`
		length, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return "", err
		}
		if length < 0 {
			// -1 is a nil response
			return nil, nil
		}
		var (
			buf = make([]byte, length+2)
			pos = 0
		)
		for pos < length+2 {
			n, err := rd.Read(buf[pos:])
			if err != nil {
				return "", err
			}
			pos += n
		}
		return string(buf[:length]), nil
	case '*':
		// array
		l, err := strconv.Atoi(line[1 : len(line)-2])
		if err != nil {
			return nil, ErrProtocol
		}
		// l can be -1
		var fields []interface{}
		for ; l > 0; l-- {
			s, err := ParseReply(rd)
			if err != nil {
				return nil, err
			}
			fields = append(fields, s)
		}
		return fields, nil
	}
}
