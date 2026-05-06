/*
 * Minio Cloud Storage, (C) 2017 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type Table struct {
	Name      string
	Constants string
	Labels    []Label
}

func (t *Table) isPresent() bool {
	return len(t.Name) > 0
}

type Label struct {
	Name   string
	Offset uint
}

func getSingleNumber(line string) int64 {

	if len(strings.Fields(line)) > 2 {
		panic(fmt.Sprintf("Too many fields found: %d", len(strings.Fields(line))))
	}
	field := strings.Fields(line)[1]
	if len(strings.Split(field, ",")) > 1 {
		panic(fmt.Sprintf("Unexpected comma found in field: %s", field))
	}
	v, err := strconv.ParseInt(field, 10, 64)
	if err != nil {
		panic(fmt.Sprintf("Number parsing error: %v", err))
	}
	return v
}

func getDualNumbers(line string) (int64, int64) {

	if len(strings.Fields(line)) > 2 {
		panic(fmt.Sprintf("Too many fields found: %d", len(strings.Fields(line))))
	}
	field := strings.Fields(line)[1]
	args := strings.Split(field, ",")
	if len(args) > 2 {
		panic(fmt.Sprintf("Too many commas found in field: %s", field))
	}
	r1, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil {
		panic(fmt.Sprintf("Number parsing error: %v", err))
	}
	r2 := int64(0)
	if len(args) > 1 {
		r2, err = strconv.ParseInt(args[1], 10, 64)
		if err != nil {
			panic(fmt.Sprintf("Number parsing error: %v", err))
		}
	}

	return r1, r2
}

// Sanify check to detect labels with identical offsets
func sanityCheckLabels(labels []Label) {

	for i := 0; i < len(labels)-1; i++ {
		if labels[i].Offset == labels[i+1].Offset {
			panic(fmt.Sprintf("Detected two labels with identical offsets: %v and %v", labels[i], labels[i+1]))
		}
	}
}

func defineTable(constants []string, tableName string) Table {

	labels := []Label{}
	bytes := make([]byte, 0, 1000)

	for _, line := range constants {

		line, _ = stripComments(line)

		if strings.HasSuffix(line, ":") {
			labels = append(labels, Label{Name: line[:len(line)-1], Offset: uint(len(bytes))})
		} else if strings.Contains(line, ".byte") {
			v := getSingleNumber(line)
			bytes = append(bytes, byte(v))
		} else if strings.Contains(line, ".short") {
			v := getSingleNumber(line)
			bytes = append(bytes, byte(v))
			bytes = append(bytes, byte(v>>8))
		} else if strings.Contains(line, ".long") {
			v := getSingleNumber(line)
			bytes = append(bytes, byte(v))
			bytes = append(bytes, byte(v>>8))
			bytes = append(bytes, byte(v>>16))
			bytes = append(bytes, byte(v>>24))
		} else if strings.Contains(line, ".quad") {
			v, err := strconv.ParseInt(strings.Fields(line)[1], 10, 64)
			if err != nil {
				panic(fmt.Sprintf("Atoi error for .quad: %v", err))
			}
			bytes = append(bytes, byte(v))
			bytes = append(bytes, byte(v>>8))
			bytes = append(bytes, byte(v>>16))
			bytes = append(bytes, byte(v>>24))
			bytes = append(bytes, byte(v>>32))
			bytes = append(bytes, byte(v>>40))
			bytes = append(bytes, byte(v>>48))
			bytes = append(bytes, byte(v>>56))
		} else if strings.Contains(line, ".align") || strings.Contains(line, ".p2align") {
			fields := strings.FieldsFunc(line, func(c rune) bool { return c == ',' || c == ' ' || c == '\t' })
			if len(fields) <= 1 || 4 <= len(fields) {
				panic(fmt.Sprintf(".p2align must have 2 or 3 arguments; got %v", fields))
			}
			bits, err := strconv.ParseInt(fields[1], 10, 64)
			if err != nil {
				panic(err)
			}
			padVal := int64(0)
			if len(fields) > 2 {
				padVal, err = strconv.ParseInt(fields[2], 0, 64)
				if err != nil {
					panic(err)
				}
			}
			align := 1 << uint(bits)
			if strings.Contains(line, ".align") &&
				(strings.Contains(strings.ToLower(*targetFlag), "x86") ||
					strings.Contains(strings.ToLower(*targetFlag), "amd64")) {
				// For historic reasons, the behavior of .align differs between
				// architectures. The llvm for x86 alignment is in bytes.
				// https://reviews.llvm.org/D16549
				// http://lists.llvm.org/pipermail/llvm-dev/2009-June/022771.html
				// https://users.elis.ugent.be/~jvcleemp/LLVM-2.4-doxygen/TargetAsmInfo_8h_source.html#l00261
				align = int(bits)
			}
			for len(bytes)%align != 0 {
				bytes = append(bytes, byte(padVal))
			}
		} else if strings.Contains(line, ".space") || strings.Contains(line, ".zero") {
			length, b := getDualNumbers(line)
			for i := int64(0); i < length; i++ {
				bytes = append(bytes, byte(b))
			}
		} else if strings.Contains(line, ".section") {
			// ignore
		} else if strings.Contains(line, ".text") {
			// ignore
		} else {
			panic(fmt.Sprintf("Unknown line for table: %s", line))
		}
	}

	// Pad onto a multiple of 8 bytes for aligned outputting
	for len(bytes)%8 != 0 {
		bytes = append(bytes, 0)
	}

	table := []string{}

	for i := 0; i < len(bytes); i += 8 {
		offset := fmt.Sprintf("%03x", i)
		hex := ""
		for j := i; j < i+8 && j < len(bytes); j++ {
			hex = fmt.Sprintf("%02x", bytes[j]) + hex
		}
		table = append(table, fmt.Sprintf("DATA %s<>+0x%s(SB)/8, $0x%s", tableName, offset, hex))
	}
	table = append(table, fmt.Sprintf("GLOBL %s<>(SB), 8, $%d", tableName, len(bytes)))

	sanityCheckLabels(labels)

	return Table{Name: tableName, Constants: strings.Join(table, "\n"), Labels: labels}
}

var regexpLabelConstant = regexp.MustCompile(`^\.?LCPI[0-9]+_0:`)

func getFirstLabelConstants(lines []string) int {

	for iline, line := range lines {
		if match := regexpLabelConstant.FindStringSubmatch(line); len(match) > 0 {
			return iline
		}
	}

	return -1
}

type Const struct {
	name       string
	start, end int
}

func segmentConstTables(lines []string) []Table {

	consts := []Const{}

	globals := splitOnGlobals(lines)

	if len(globals) == 0 {
		return []Table{}
	}

	splitBegin := 0
	for _, global := range globals {
		start := getFirstLabelConstants(lines[splitBegin:global.dotGlobalLine])
		if start != -1 {
			// Add set of lines when a constant table has been found
			consts = append(consts, Const{name: fmt.Sprintf("LCDATA%d", len(consts)+1), start: splitBegin + start, end: global.dotGlobalLine})
		}
		splitBegin = global.dotGlobalLine + 1
	}

	tables := []Table{}

	for _, c := range consts {

		tables = append(tables, defineTable(lines[c.start:c.end], c.name))
	}

	return tables
}

func getCorrespondingTable(lines []string, tables []Table) Table {

	concat := strings.Join(lines, "\n")

	for _, t := range tables {
		// Easy test -- we assume that if we find one label, we would find the others as well...
		if strings.Contains(concat, t.Labels[0].Name) {
			return t
		}
	}

	return Table{}
}
