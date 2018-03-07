package redis

import (
	"crypto/sha1"
	"encoding/hex"
	"io"
	"strings"
)

type scripter interface {
	Eval(script string, keys []string, args []string) *Cmd
	EvalSha(sha1 string, keys []string, args []string) *Cmd
	ScriptExists(scripts ...string) *BoolSliceCmd
	ScriptLoad(script string) *StringCmd
}

type Script struct {
	src, hash string
}

func NewScript(src string) *Script {
	h := sha1.New()
	io.WriteString(h, src)
	return &Script{
		src:  src,
		hash: hex.EncodeToString(h.Sum(nil)),
	}
}

func (s *Script) Load(c scripter) *StringCmd {
	return c.ScriptLoad(s.src)
}

func (s *Script) Exists(c scripter) *BoolSliceCmd {
	return c.ScriptExists(s.src)
}

func (s *Script) Eval(c scripter, keys []string, args []string) *Cmd {
	return c.Eval(s.src, keys, args)
}

func (s *Script) EvalSha(c scripter, keys []string, args []string) *Cmd {
	return c.EvalSha(s.hash, keys, args)
}

func (s *Script) Run(c *Client, keys []string, args []string) *Cmd {
	r := s.EvalSha(c, keys, args)
	if err := r.Err(); err != nil && strings.HasPrefix(err.Error(), "NOSCRIPT ") {
		return s.Eval(c, keys, args)
	}
	return r
}
