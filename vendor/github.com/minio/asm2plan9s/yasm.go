package main

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"strings"
	"unicode"
)

///////////////////////////////////////////////////////////////////////////////
//
// Y A S M   S U P P O R T
//
///////////////////////////////////////////////////////////////////////////////

//
// yasm-assemble-disassemble-roundtrip-sse.txt
//
// franks-mbp:sse frankw$ more assembly.asm
// [bits 64]
//
// VPXOR   YMM4, YMM2, YMM3    ; X4: Result
// franks-mbp:sse frankw$ yasm assembly.asm
// franks-mbp:sse frankw$ hexdump -C assembly
// 00000000  c5 ed ef e3                                       |....|
// 00000004
// franks-mbp:sse frankw$ echo 'lbl: db 0xc5, 0xed, 0xef, 0xe3' | yasm -f elf - -o assembly.o
// franks-mbp:sse frankw$ gobjdump -d -M intel assembly.o
//
// assembly.o:     file format elf32-i386
//
//
// Disassembly of section .text:
//
// 00000000 <.text>:
// 0:   c5 ed ef e3             vpxor  ymm4,ymm2,ymm3

func yasm(instructions []Instruction) error {
	for i, ins := range instructions {
		assembled, opcodes, err := yasmSingle(ins.instruction, ins.lineno, ins.commentPos, ins.inDefine)
		if err != nil {
			return err
		}
		instructions[i].assembled = assembled
		instructions[i].opcodes = make([]byte, len(opcodes))
		copy(instructions[i].opcodes[:], opcodes)
	}
	return nil
}

func yasmSingle(instr string, lineno, commentPos int, inDefine bool) (string, []byte, error) {

	instrFields := strings.Split(instr, "/*")
	content := []byte("[bits 64]\n" + instrFields[0])
	tmpfile, err := ioutil.TempFile("", "asm2plan9s")
	if err != nil {
		return "", nil, err
	}

	if _, err := tmpfile.Write(content); err != nil {
		return "", nil, err
	}
	if err := tmpfile.Close(); err != nil {
		return "", nil, err
	}

	asmFile := tmpfile.Name() + ".asm"
	objFile := tmpfile.Name() + ".obj"
	os.Rename(tmpfile.Name(), asmFile)

	defer os.Remove(asmFile) // clean up
	defer os.Remove(objFile) // clean up

	app := "yasm"

	arg0 := "-o"
	arg1 := objFile
	arg2 := asmFile

	cmd := exec.Command(app, arg0, arg1, arg2)
	cmb, err := cmd.CombinedOutput()
	if err != nil {
		if len(string(cmb)) == 0 { // command invocation failed
			return "", nil, errors.New("exec error: YASM not installed?")
		}
		yasmErrs := strings.Split(string(cmb)[len(asmFile)+1:], ":")
		yasmErr := strings.Join(yasmErrs[1:], ":")
		return "", nil, errors.New(fmt.Sprintf("YASM error (line %d for '%s'):", lineno+1, strings.TrimSpace(instr)) + yasmErr)
	}

	return toPlan9sYasm(objFile, instr, commentPos, inDefine)
}

func toPlan9sYasm(objFile, instr string, commentPos int, inDefine bool) (string, []byte, error) {
	opcodes, err := ioutil.ReadFile(objFile)
	if err != nil {
		return "", nil, err
	}

	s, err := toPlan9s(opcodes, instr, commentPos, inDefine)
	return s, opcodes, err
}

func toPlan9s(opcodes []byte, instr string, commentPos int, inDefine bool) (string, error) {
	sline := "    "
	i := 0
	// First do QUADs (as many as needed)
	for ; len(opcodes) >= 8; i++ {
		if i != 0 {
			sline += "; "
		}
		sline += fmt.Sprintf("QUAD $0x%02x%02x%02x%02x%02x%02x%02x%02x", opcodes[7], opcodes[6], opcodes[5], opcodes[4], opcodes[3], opcodes[2], opcodes[1], opcodes[0])

		opcodes = opcodes[8:]
	}
	// Then do LONGs (as many as needed)
	for ; len(opcodes) >= 4; i++ {
		if i != 0 {
			sline += "; "
		}
		sline += fmt.Sprintf("LONG $0x%02x%02x%02x%02x", opcodes[3], opcodes[2], opcodes[1], opcodes[0])

		opcodes = opcodes[4:]
	}

	// Then do a WORD (if needed)
	if len(opcodes) >= 2 {

		if i != 0 {
			sline += "; "
		}
		sline += fmt.Sprintf("WORD $0x%02x%02x", opcodes[1], opcodes[0])

		i++
		opcodes = opcodes[2:]
	}

	// And close with a BYTE (if needed)
	if len(opcodes) == 1 {
		if i != 0 {
			sline += "; "
		}
		sline += fmt.Sprintf("BYTE $0x%02x", opcodes[0])

		i++
		opcodes = opcodes[1:]
	}

	if inDefine {
		if commentPos > commentPos-2-len(sline) {
			if commentPos-2-len(sline) > 0 {
				sline += strings.Repeat(" ", commentPos-2-len(sline))
			}
		} else {
			sline += " "
		}
		sline += `\ `
	} else {
		if commentPos > len(sline) {
			if commentPos-len(sline) > 0 {
				sline += strings.Repeat(" ", commentPos-len(sline))
			}
		} else {
			sline += " "
		}
	}

	if instr != "" {
		sline += "//" + instr
	}

	return strings.TrimRightFunc(sline, unicode.IsSpace), nil
}
