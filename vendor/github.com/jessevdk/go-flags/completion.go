package flags

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"unicode/utf8"
)

// Completion is a type containing information of a completion.
type Completion struct {
	// The completed item
	Item string

	// A description of the completed item (optional)
	Description string
}

type completions []Completion

func (c completions) Len() int {
	return len(c)
}

func (c completions) Less(i, j int) bool {
	return c[i].Item < c[j].Item
}

func (c completions) Swap(i, j int) {
	c[i], c[j] = c[j], c[i]
}

// Completer is an interface which can be implemented by types
// to provide custom command line argument completion.
type Completer interface {
	// Complete receives a prefix representing a (partial) value
	// for its type and should provide a list of possible valid
	// completions.
	Complete(match string) []Completion
}

type completion struct {
	parser *Parser
}

// Filename is a string alias which provides filename completion.
type Filename string

func completionsWithoutDescriptions(items []string) []Completion {
	ret := make([]Completion, len(items))

	for i, v := range items {
		ret[i].Item = v
	}

	return ret
}

// Complete returns a list of existing files with the given
// prefix.
func (f *Filename) Complete(match string) []Completion {
	ret, _ := filepath.Glob(match + "*")
	if len(ret) == 1 {
		if info, err := os.Stat(ret[0]); err == nil && info.IsDir() {
			ret[0] = ret[0] + "/"
		}
	}
	return completionsWithoutDescriptions(ret)
}

func (c *completion) skipPositional(s *parseState, n int) {
	if n >= len(s.positional) {
		s.positional = nil
	} else {
		s.positional = s.positional[n:]
	}
}

func (c *completion) completeOptionNames(s *parseState, prefix string, match string, short bool) []Completion {
	if short && len(match) != 0 {
		return []Completion{
			{
				Item: prefix + match,
			},
		}
	}

	var results []Completion
	repeats := map[string]bool{}

	for name, opt := range s.lookup.longNames {
		if strings.HasPrefix(name, match) && !opt.Hidden {
			results = append(results, Completion{
				Item:        defaultLongOptDelimiter + name,
				Description: opt.Description,
			})

			if short {
				repeats[string(opt.ShortName)] = true
			}
		}
	}

	if short {
		for name, opt := range s.lookup.shortNames {
			if _, exist := repeats[name]; !exist && strings.HasPrefix(name, match) && !opt.Hidden {
				results = append(results, Completion{
					Item:        string(defaultShortOptDelimiter) + name,
					Description: opt.Description,
				})
			}
		}
	}

	return results
}

func (c *completion) completeNamesForLongPrefix(s *parseState, prefix string, match string) []Completion {
	return c.completeOptionNames(s, prefix, match, false)
}

func (c *completion) completeNamesForShortPrefix(s *parseState, prefix string, match string) []Completion {
	return c.completeOptionNames(s, prefix, match, true)
}

func (c *completion) completeCommands(s *parseState, match string) []Completion {
	n := make([]Completion, 0, len(s.command.commands))

	for _, cmd := range s.command.commands {
		if cmd.data != c && !cmd.Hidden && strings.HasPrefix(cmd.Name, match) {
			n = append(n, Completion{
				Item:        cmd.Name,
				Description: cmd.ShortDescription,
			})
		}
	}

	return n
}

func (c *completion) completeValue(value reflect.Value, prefix string, match string) []Completion {
	if value.Kind() == reflect.Slice {
		value = reflect.New(value.Type().Elem())
	}
	i := value.Interface()

	var ret []Completion

	if cmp, ok := i.(Completer); ok {
		ret = cmp.Complete(match)
	} else if value.CanAddr() {
		if cmp, ok = value.Addr().Interface().(Completer); ok {
			ret = cmp.Complete(match)
		}
	}

	for i, v := range ret {
		ret[i].Item = prefix + v.Item
	}

	return ret
}

func (c *completion) complete(args []string) []Completion {
	if len(args) == 0 {
		args = []string{""}
	}

	s := &parseState{
		args: args,
	}

	c.parser.fillParseState(s)

	var opt *Option

	for len(s.args) > 1 {
		arg := s.pop()

		if (c.parser.Options&PassDoubleDash) != None && arg == "--" {
			opt = nil
			c.skipPositional(s, len(s.args)-1)

			break
		}

		if argumentIsOption(arg) {
			prefix, optname, islong := stripOptionPrefix(arg)
			optname, _, argument := splitOption(prefix, optname, islong)

			if argument == nil {
				var o *Option
				canarg := true

				if islong {
					o = s.lookup.longNames[optname]
				} else {
					for i, r := range optname {
						sname := string(r)
						o = s.lookup.shortNames[sname]

						if o == nil {
							break
						}

						if i == 0 && o.canArgument() && len(optname) != len(sname) {
							canarg = false
							break
						}
					}
				}

				if o == nil && (c.parser.Options&PassAfterNonOption) != None {
					opt = nil
					c.skipPositional(s, len(s.args)-1)

					break
				} else if o != nil && o.canArgument() && !o.OptionalArgument && canarg {
					if len(s.args) > 1 {
						s.pop()
					} else {
						opt = o
					}
				}
			}
		} else {
			if len(s.positional) > 0 {
				if !s.positional[0].isRemaining() {
					// Don't advance beyond a remaining positional arg (because
					// it consumes all subsequent args).
					s.positional = s.positional[1:]
				}
			} else if cmd, ok := s.lookup.commands[arg]; ok {
				cmd.fillParseState(s)
			}

			opt = nil
		}
	}

	lastarg := s.args[len(s.args)-1]
	var ret []Completion

	if opt != nil {
		// Completion for the argument of 'opt'
		ret = c.completeValue(opt.value, "", lastarg)
	} else if argumentStartsOption(lastarg) {
		// Complete the option
		prefix, optname, islong := stripOptionPrefix(lastarg)
		optname, split, argument := splitOption(prefix, optname, islong)

		if argument == nil && !islong {
			rname, n := utf8.DecodeRuneInString(optname)
			sname := string(rname)

			if opt := s.lookup.shortNames[sname]; opt != nil && opt.canArgument() {
				ret = c.completeValue(opt.value, prefix+sname, optname[n:])
			} else {
				ret = c.completeNamesForShortPrefix(s, prefix, optname)
			}
		} else if argument != nil {
			if islong {
				opt = s.lookup.longNames[optname]
			} else {
				opt = s.lookup.shortNames[optname]
			}

			if opt != nil {
				ret = c.completeValue(opt.value, prefix+optname+split, *argument)
			}
		} else if islong {
			ret = c.completeNamesForLongPrefix(s, prefix, optname)
		} else {
			ret = c.completeNamesForShortPrefix(s, prefix, optname)
		}
	} else if len(s.positional) > 0 {
		// Complete for positional argument
		ret = c.completeValue(s.positional[0].value, "", lastarg)
	} else if len(s.command.commands) > 0 {
		// Complete for command
		ret = c.completeCommands(s, lastarg)
	}

	sort.Sort(completions(ret))
	return ret
}

func (c *completion) print(items []Completion, showDescriptions bool) {
	if showDescriptions && len(items) > 1 {
		maxl := 0

		for _, v := range items {
			if len(v.Item) > maxl {
				maxl = len(v.Item)
			}
		}

		for _, v := range items {
			fmt.Printf("%s", v.Item)

			if len(v.Description) > 0 {
				fmt.Printf("%s  # %s", strings.Repeat(" ", maxl-len(v.Item)), v.Description)
			}

			fmt.Printf("\n")
		}
	} else {
		for _, v := range items {
			fmt.Println(v.Item)
		}
	}
}
