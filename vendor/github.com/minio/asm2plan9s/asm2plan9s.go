/*
 * Minio Cloud Storage, (C) 2016-2017 Minio, Inc.
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
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

type Instruction struct {
	instruction string
	lineno      int
	commentPos  int
	inDefine    bool
	assembled   string
	opcodes     []byte
}

type Assembler struct {
	Prescan      bool
	Instructions []Instruction
	Compact      bool
}

// assemble assembles an array of lines into their
// resulting plan9 equivalents
func (a *Assembler) assemble(lines []string) ([]string, error) {

	result := make([]string, 0)

	for lineno, line := range lines {
		startsWithTab := strings.HasPrefix(line, "\t")
		line := strings.Replace(line, "\t", "    ", -1)
		fields := strings.Split(line, "//")
		if len(fields) == 2 && (startsAfterLongWordByteSequence(fields[0]) || len(fields[0]) == 65) {

			// test whether string before instruction is terminated with a backslash (so used in a #define)
			trimmed := strings.TrimSpace(fields[0])
			inDefine := len(trimmed) > 0 && string(trimmed[len(trimmed)-1]) == `\`

			// While prescanning collect the instructions
			if a.Prescan {
				ins := Instruction{instruction: fields[1], lineno: lineno, commentPos: len(fields[0]), inDefine: inDefine}
				a.Instructions = append(a.Instructions, ins)
				continue
			}

			var ins *Instruction
			for i := range a.Instructions {
				if lineno == a.Instructions[i].lineno {
					ins = &a.Instructions[i]
				}
			}
			if ins == nil {
				if a.Compact {
					continue
				}
				panic("failed to find entry with correct line number")
			}
			if startsWithTab {
				ins.assembled = strings.Replace(ins.assembled, "    ", "\t", 1)
			}
			result = append(result, ins.assembled)
		} else if !a.Prescan {
			if startsWithTab {
				line = strings.Replace(line, "    ", "\t", 1)
			}
			result = append(result, line)
		}
	}

	return result, nil
}

// startsAfterLongWordByteSequence determines if an assembly instruction
// starts on a position after a combination of LONG, WORD, BYTE sequences
func startsAfterLongWordByteSequence(prefix string) bool {

	if len(strings.TrimSpace(prefix)) != 0 && !strings.HasPrefix(prefix, "    LONG $0x") &&
		!strings.HasPrefix(prefix, "    WORD $0x") && !strings.HasPrefix(prefix, "    BYTE $0x") {
		return false
	}

	length := 4 + len(prefix) + 1

	for objcodes := 3; objcodes <= 8; objcodes++ {

		ls, ws, bs := 0, 0, 0

		oc := objcodes

		for ; oc >= 4; oc -= 4 {
			ls++
		}
		if oc >= 2 {
			ws++
			oc -= 2
		}
		if oc == 1 {
			bs++
		}
		size := 4 + ls*(len("LONG $0x")+8) + ws*(len("WORD $0x")+4) + bs*(len("BYTE $0x")+2) + (ls+ws+bs-1)*len("; ")

		if length == size+6 { // comment starts after a space
			return true
		}
	}
	return false
}

// combineLines shortens the output by combining consecutive lines into a larger list of opcodes
func (a *Assembler) combineLines() {
	startIndex, startLine, opcodes := -1, -1, make([]byte, 0, 1024)
	combined := make([]Instruction, 0, 100)
	for i, ins := range a.Instructions {
		if startIndex == -1 {
			startIndex, startLine = i, ins.lineno
		}
		if ins.lineno != startLine+(i-startIndex) { // we have found a non-consecutive line
			combiAssem, _ := toPlan9s(opcodes, "", 0, false)
			combiIns := Instruction{assembled: combiAssem, lineno: startLine, inDefine: false}

			combined = append(combined, combiIns)
			opcodes = opcodes[:0]
			startIndex, startLine = i, ins.lineno
		}
		opcodes = append(opcodes, ins.opcodes...)
	}
	if len(opcodes) > 0 {
		combiAssem, _ := toPlan9s(opcodes, "", 0, false)
		ins := Instruction{assembled: combiAssem, lineno: startLine, inDefine: false}

		combined = append(combined, ins)
	}

	a.Instructions = combined
}

// readLines reads a whole file into memory
// and returns a slice of its lines.
func readLines(path string, in io.Reader) ([]string, error) {
	if in == nil {
		file, err := os.Open(path)
		if err != nil {
			return nil, err
		}
		defer file.Close()
		in = file
	}

	var lines []string
	scanner := bufio.NewScanner(in)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines, scanner.Err()
}

// writeLines writes the lines to the given file.
func writeLines(lines []string, path string, out io.Writer) error {
	if path != "" {
		file, err := os.Create(path)
		if err != nil {
			return err
		}
		defer file.Close()
		out = file
	}

	w := bufio.NewWriter(out)
	for _, line := range lines {
		fmt.Fprintln(w, line)
	}
	return w.Flush()
}

func assemble(lines []string, compact bool) (result []string, err error) {

	// TODO: Make compaction configurable
	a := Assembler{Prescan: true, Compact: compact}

	_, err = a.assemble(lines)
	if err != nil {
		return result, err
	}

	err = as(a.Instructions)
	if err != nil {
		return result, err
	}

	if a.Compact {
		a.combineLines()
	}

	a.Prescan = false
	result, err = a.assemble(lines)
	if err != nil {
		return result, err
	}

	return result, nil
}

func main() {

	file := ""
	if len(os.Args) >= 2 {
		file = os.Args[1]
	}

	var lines []string
	var err error
	if len(file) > 0 {
		fmt.Println("Processing file", file)
		lines, err = readLines(file, nil)
	} else {
		lines, err = readLines("", os.Stdin)
	}
	if err != nil {
		log.Fatalf("readLines: %s", err)
	}

	result, err := assemble(lines, false)
	if err != nil {
		fmt.Print(err)
		os.Exit(-1)
	}

	err = writeLines(result, file, os.Stdout)
	if err != nil {
		log.Fatalf("writeLines: %s", err)
	}
}
