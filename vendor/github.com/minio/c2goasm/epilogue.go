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
)

type Epilogue struct {
	Pops             []string // list of registers that are popped of the stack
	SetRbpInstr      bool     // is there an instruction to set Rbp in epilogue?
	StackSize        uint     // the size of the C stack
	AlignedStack     bool     // is this an aligned stack?
	AlignValue       uint     // alignment value in case of an aligned stack
	VZeroUpper       bool     // is there a vzeroupper instruction in the epilogue?
	Start, End       int      // start and ending lines of epilogue
	_missingPops     int      // internal variable to identify first push without a corresponding pop
	_stackGrowthSign int      // direction to grow stack in case of detecting a push without a corresponding pop
}

var regexpAddRsp = regexp.MustCompile(`^\s*add\s*rsp, ([0-9]+)$`)
var regexpAndRsp = regexp.MustCompile(`^\s*and\s*rsp, \-([0-9]+)$`)
var regexpSubRsp = regexp.MustCompile(`^\s*sub\s*rsp, ([0-9]+)$`)
var regexpLeaRsp = regexp.MustCompile(`^\s*lea\s*rsp, `)
var regexpPop = regexp.MustCompile(`^\s*pop\s*([a-z0-9]+)$`)
var regexpPush = regexp.MustCompile(`^\s*push\s*([a-z0-9]+)$`)
var regexpMov = regexp.MustCompile(`^\s*mov\s*([a-z0-9]+), ([a-z0-9]+)$`)
var regexpVZeroUpper = regexp.MustCompile(`^\s*vzeroupper\s*$`)
var regexpReturn = regexp.MustCompile(`^\s*ret\s*$`)

type Stack struct {
	alignedStack bool // is this an aligned stack?

	goSavedSP      uint // space to save a copy of the original Stack Pointer as passed in by Go (for aligned stacks)
	goArgCopies    uint // space used to store copies of golang args not passed in registers (arguments 7 and higher)
	localSpace     uint // stack space used by C code
	freeSpace      uint // free stack space used for CALLs
	untouchedSpace uint // untouched space to prevent overwriting return address for final RET statement
}

func NewStack(epilogue Epilogue, arguments int, stackSpaceForCalls uint) Stack {

	s := Stack{localSpace: epilogue.StackSize, alignedStack: epilogue.AlignedStack, freeSpace: stackSpaceForCalls}

	if arguments-len(registers) > 0 {
		s.goArgCopies = uint(8 * (arguments - len(registers)))
	}

	if s.alignedStack {
		// For an aligned stack we need to save the original Stack Pointer as passed in by Go
		s.goSavedSP = originalStackPointer

		// We are rounding freeSpace to a multiple of the  alignment value
		s.freeSpace = (s.freeSpace + epilogue.AlignValue - 1) & ^(epilogue.AlignValue - 1)

		// Create unused space at the bottom of the stack to guarantee alignment
		s.untouchedSpace = epilogue.AlignValue
	} else {
		// Only when we are using no stack whatsoever, do we not need to reserve space to save the return address
		if s.freeSpace+s.localSpace+s.goArgCopies+s.goSavedSP > 0 {
			s.untouchedSpace = 8
		}
	}

	return s
}

// Get total local stack frame size (for Go) used in TEXT definition
func (s Stack) GolangLocalStackFrameSize() uint {
	return s.untouchedSpace + s.freeSpace + s.localSpace + s.goArgCopies + s.goSavedSP
}

// Get offset to adjust Stack Pointer appropriately for C code
func (s Stack) StackPointerOffsetForC() uint {
	return s.untouchedSpace + s.freeSpace
}

// Get offset (from C Stack Pointer) for saving original Golang Stack Pointer
func (s Stack) OffsetForSavedSP() uint {
	if s.goSavedSP == 0 {
		panic("There should be space reserved for OffsetForSavedSP")
	}
	return s.localSpace + s.goArgCopies
}

// Get offset (from C Stack Pointer) for copy of Golang arguments 7 and higher
func (s Stack) OffsetForGoArg(iarg int) uint {

	offset := uint((iarg - len(registers)) * 8)
	if offset > s.goArgCopies {
		panic("Offset for higher number argument asked for than reserved")
	}
	return s.localSpace + offset
}

func extractEpilogueInfo(src []string, sliceStart, sliceEnd int) Epilogue {

	epilogue := Epilogue{Start: sliceStart, End: sliceEnd}

	// Iterate over epilogue, starting from last instruction
	for ipost := sliceEnd - 1; ipost >= sliceStart; ipost-- {
		line := src[ipost]

		if !epilogue.extractEpilogue(line) {
			panic(fmt.Sprintf("Unknown line for epilogue: %s", line))
		}
	}

	return epilogue
}

func (e *Epilogue) extractEpilogue(line string) bool {

	if match := regexpPop.FindStringSubmatch(line); len(match) > 1 {
		register := match[1]

		e.Pops = append(e.Pops, register)
		if register == "rbp" {
			e.SetRbpInstr = true
		}
	} else if match := regexpAddRsp.FindStringSubmatch(line); len(match) > 1 {
		size, _ := strconv.Atoi(match[1])
		e.StackSize = uint(size)
	} else if match := regexpLeaRsp.FindStringSubmatch(line); len(match) > 0 {
		e.AlignedStack = true
	} else if match := regexpVZeroUpper.FindStringSubmatch(line); len(match) > 0 {
		e.VZeroUpper = true
	} else if match := regexpMov.FindStringSubmatch(line); len(match) > 2 && match[1] == "rsp" && match[2] == "rbp" {
		// no action to take
	} else if match := regexpReturn.FindStringSubmatch(line); len(match) > 0 {
		// no action to take
	} else {
		return false
	}

	return true
}

func isEpilogueInstruction(line string) bool {

	return (&Epilogue{}).extractEpilogue(line)
}

func (e *Epilogue) isPrologueInstruction(line string) bool {

	if match := regexpPush.FindStringSubmatch(line); len(match) > 1 {
		hasCorrespondingPop := listContains(match[1], e.Pops)
		if !hasCorrespondingPop {
			e._missingPops++
			if e._missingPops == 1 { // only for first missing pop, set initial direction of growth to adapt check
				if e.StackSize > 0 {
					// Missing corresponding `pop` but rsp was modified directly in epilogue (see test-case pro/epilogue6)
					e._stackGrowthSign = -1
				} else {
					// Missing corresponding `pop` meaning rsp is grown indirectly in prologue (see test-case pro/epilogue7)
					e._stackGrowthSign = 1
				}
			}
			e.StackSize += uint(8 * e._stackGrowthSign)
			if e.StackSize == 0 && e._stackGrowthSign == -1 {
				e._stackGrowthSign = 1 // flip direction once stack has shrunk to zero
			}
		}
		return true
	} else if match := regexpMov.FindStringSubmatch(line); len(match) > 2 && match[1] == "rbp" && match[2] == "rsp" {
		if e.SetRbpInstr {
			return true
		} else {
			panic(fmt.Sprintf("mov found but not expected to be set: %s", line))
		}
	} else if match := regexpAndRsp.FindStringSubmatch(line); len(match) > 1 {
		align, _ := strconv.Atoi(match[1])
		if e.AlignedStack && align == 8 {
			// golang stack is already 8 byte aligned so we can effectively disable the aligned stack
			e.AlignedStack = false
		} else {
			e.AlignValue = uint(align)
		}

		return true
	} else if match := regexpSubRsp.FindStringSubmatch(line); len(match) > 1 {
		space, _ := strconv.Atoi(match[1])
		if !e.AlignedStack && e.StackSize == uint(space) {
			return true
		} else if e.StackSize == 0 || e.StackSize == uint(space) {
			e.StackSize = uint(space) // Update stack size when found in header (and missing in footer due to `lea` instruction)
			return true
		} else {
			panic(fmt.Sprintf("'sub rsp' found but in unexpected scenario: %s", line))
		}
	}

	return false
}

func listContains(value string, list []string) bool {
	for _, v := range list {
		if v == value {
			return true
		}
	}
	return false
}
