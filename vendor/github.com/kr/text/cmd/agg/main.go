package main

// TODO(kr): tests

import (
	"bufio"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"
)

type agg interface {
	merge(string)
	String() string
}

var (
	key     = 0
	funcmap = make(map[int]func(init, arg string) agg)
	argmap  = make(map[int]string)
	symtab  = map[string]func(init, arg string) agg{
		"first":  first,
		"last":   last,
		"prefix": prefix,
		"sample": sample,
		"join":   join,
		"smin":   smin,
		"smax":   smax,
		"min":    min,
		"max":    max,
		"sum":    sum,
		"mean":   mean,
		"count":  count,
		"const":  constf,
		"drop":   nil,
	}
)

func main() {
	log.SetPrefix("agg: ")
	log.SetFlags(0)
	rand.Seed(time.Now().UnixNano())
	for i, sym := range os.Args[1:] {
		if p := strings.IndexByte(sym, ':'); p >= 0 {
			sym, argmap[i] = sym[:p], sym[p+1:]
		}
		if sym == "key" {
			key, sym = i, "first"
		}
		f, ok := symtab[sym]
		if !ok {
			log.Fatalf("bad function: %q", sym)
		}
		funcmap[i] = f
	}

	sc := bufio.NewScanner(os.Stdin)
	var g *group
	for sc.Scan() {
		ss := strings.Fields(sc.Text())
		if !matches(g, ss) {
			emit(g)
			g = &group{key: ss[key]}
		}
		mergeLine(g, ss)
	}
	emit(g)
}

type group struct {
	key string
	agg []agg
}

func matches(g *group, ss []string) bool {
	return g != nil && g.key == ss[key]
}

func emit(g *group) {
	if g == nil {
		return
	}
	rest := false
	for i, a := range g.agg {
		if f, ok := funcmap[i]; ok && f == nil {
			continue
		}
		if rest {
			fmt.Print("\t")
		}
		rest = true
		fmt.Print(a)
	}
	fmt.Println()
}

func mergeLine(g *group, ss []string) {
	for i, s := range ss {
		if i >= len(g.agg) {
			f := funcmap[i]
			if f == nil {
				f = first
			}
			g.agg = append(g.agg, f(s, argmap[i]))
		} else {
			g.agg[i].merge(s)
		}
	}
}
