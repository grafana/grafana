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
	"unicode"
)

const originalStackPointer = 8

var registers = [...]string{"DI", "SI", "DX", "CX", "R8", "R9"}
var registersAdditional = [...]string{"R10", "R11", "R12", "R13", "R14", "R15", "AX", "BX"}
var regexpCall = regexp.MustCompile(`^\s*call\s*`)
var regexpPushInstr = regexp.MustCompile(`^\s*push\s*`)
var regexpPopInstr = regexp.MustCompile(`^\s*pop\s*`)
var regexpLabel = regexp.MustCompile(`^(\.?LBB.*?:)`)
var regexpJumpTableRef = regexp.MustCompile(`\[rip \+ (\.?LJTI[_0-9]*)\]\s*$`)
var regexpJumpWithLabel = regexp.MustCompile(`^(\s*j\w*)\s*(\.?LBB.*)`)
var regexpRbpLoadHigher = regexp.MustCompile(`\[rbp \+ ([0-9]+)\]`)
var regexpRbpLoadLower = regexp.MustCompile(`\[rbp - ([0-9]+)\]`)
var regexpStripComments = regexp.MustCompile(`\s*#?#\s.*$`)

// Write the prologue for the subroutine
func writeGoasmPrologue(sub Subroutine, stack Stack, arguments, returnValues []string) []string {

	//if sub.name == "SimdSse2MedianFilterRhomb3x3" {
	//	fmt.Println("sub.name", sub.name)
	//	fmt.Println("sub.epilogue", sub.epilogue)
	//	fmt.Println("arguments", arguments)
	//	fmt.Println("returnValues", returnValues)
	//	fmt.Println("table.Name", sub.table.Name)
	//}

	var result []string

	// Output definition of subroutine
	result = append(result, fmt.Sprintf("TEXT ·_%s(SB), $%d-%d", sub.name, stack.GolangLocalStackFrameSize(),
		getTotalSizeOfArgumentsAndReturnValues(0, len(arguments)-1, returnValues)), "")

	// Load Golang arguments into registers
	for iarg, arg := range arguments {

		if iarg < len(registers) {
			// Load initial arguments (up to 6) in corresponding registers
			result = append(result, fmt.Sprintf("    MOVQ %s+%d(FP), %s", arg, iarg*8, registers[iarg]))
		} else if iarg-len(registers) < len(registersAdditional) {
			// Load following arguments into additional registers
			result = append(result, fmt.Sprintf("    MOVQ %s+%d(FP), %s", arg, iarg*8, registersAdditional[iarg-len(registers)]))
		} else {
			panic("Trying to pass in too many arguments")
		}
	}

	// Setup the stack pointer for the C code
	if sub.epilogue.AlignedStack {
		// Align stack pointer to next multiple of alignment space
		result = append(result, fmt.Sprintf("    MOVQ SP, BP"))
		result = append(result, fmt.Sprintf("    ADDQ $%d, SP", stack.StackPointerOffsetForC() /*sub.epilogue.AlignValue*/))
		result = append(result, fmt.Sprintf("    ANDQ $-%d, SP", sub.epilogue.AlignValue))

		// Save original stack pointer right below newly aligned stack pointer
		result = append(result, fmt.Sprintf("    MOVQ BP, %d(SP)", stack.OffsetForSavedSP())) // Save original SP

	} else if stack.StackPointerOffsetForC() != 0 { // sub.epilogue.getStackSpace(len(arguments)) != 0 {
		// Create stack space as needed
		result = append(result, fmt.Sprintf("    ADDQ $%d, SP", stack.StackPointerOffsetForC() /*sub.epilogue.getFreeSpaceAtBottom())*/))
	}

	// Save Golang arguments beyond 6 onto stack
	for iarg := len(arguments) - 1; iarg-len(registers) >= 0; iarg-- {
		result = append(result, fmt.Sprintf("    MOVQ %s, %d(SP)", registersAdditional[iarg-len(registers)], stack.OffsetForGoArg(iarg)))
	}

	// Setup base pointer for loading constants
	if sub.table.isPresent() {
		result = append(result, fmt.Sprintf("    LEAQ %s<>(SB), BP", sub.table.Name))
	}

	return append(result, ``)
}

func writeGoasmBody(sub Subroutine, stack Stack, stackArgs StackArgs, arguments, returnValues []string) ([]string, error) {

	var result []string

	for iline, line := range sub.body {

		// If part of epilogue
		if iline >= sub.epilogue.Start && iline < sub.epilogue.End {

			// Instead of last line, output go assembly epilogue
			if iline == sub.epilogue.End-1 {
				result = append(result, writeGoasmEpilogue(sub, stack, arguments, returnValues)...)
			}
			continue
		}

		// Remove ## comments
		var skipLine bool
		line, skipLine = stripComments(line)
		if skipLine {
			continue
		}

		// Skip lines with aligns
		if strings.Contains(line, ".align") || strings.Contains(line, ".p2align") {
			continue
		}

		line, _ = fixLabels(line)
		line, _, _ = upperCaseJumps(line)
		line, _ = upperCaseCalls(line)

		fields := strings.Fields(line)
		// Test for any non-jmp instruction (lower case mnemonic)
		if len(fields) > 0 && !strings.Contains(fields[0], ":") && isLower(fields[0]) {
			// prepend line with comment for subsequent asm2plan9s assembly
			line = "                                 // " + strings.TrimSpace(line)
		}

		line = removeUndefined(line, "ptr")
		line = removeUndefined(line, "# NOREX")

		// https://github.com/vertis/objconv/blob/master/src/disasm2.cpp
		line = replaceUndefined(line, "xmmword", "oword")
		line = replaceUndefined(line, "ymmword", "yword")

		line = fixShiftInstructions(line)
		line = fixMovabsInstructions(line)
		if sub.table.isPresent() {
			line = fixPicLabels(line, sub.table)
		}

		line = fixRbpPlusLoad(line, stackArgs, stack)

		detectRbpMinusMemoryAccess(line)
		detectJumpTable(line)
		detectPushInstruction(line)
		detectPopInstruction(line)

		result = append(result, line)
	}

	return result, nil
}

// Write the epilogue for the subroutine
func writeGoasmEpilogue(sub Subroutine, stack Stack, arguments, returnValues []string) []string {

	var result []string

	// Restore the stack pointer
	if sub.epilogue.AlignedStack {
		// For an aligned stack, restore the stack pointer from the stack itself
		result = append(result, fmt.Sprintf("    MOVQ %d(SP), SP", stack.OffsetForSavedSP()))
	} else if stack.StackPointerOffsetForC() != 0 {
		// For an unaligned stack, reverse addition in order restore the stack pointer
		result = append(result, fmt.Sprintf("    SUBQ $%d, SP", stack.StackPointerOffsetForC()))
	}

	// Clear upper half of YMM register, if so done in the original code
	if sub.epilogue.VZeroUpper {
		result = append(result, "    VZEROUPPER")
	}

	if len(returnValues) == 1 {
		// Store return value of subroutine
		result = append(result, fmt.Sprintf("    MOVQ AX, %s+%d(FP)", returnValues[0],
			getTotalSizeOfArgumentsAndReturnValues(0, len(arguments)-1, returnValues)-8))
	} else if len(returnValues) > 1 {
		panic(fmt.Sprintf("Fix multiple return values: %s", returnValues))
	}

	// Finally, return out of the subroutine
	result = append(result, "    RET")

	return result
}

func scanBodyForCalls(sub Subroutine) uint {

	stackSize := uint(0)

	for _, line := range sub.body {

		_, size := upperCaseCalls(line)

		if stackSize < size {
			stackSize = size
		}
	}

	return stackSize
}

// Strip comments from assembly lines
func stripComments(line string) (result string, skipLine bool) {

	if match := regexpStripComments.FindStringSubmatch(line); len(match) > 0 {
		line = line[:len(line)-len(match[0])]
		if line == "" {
			return "", true
		}
	}
	return line, false
}

// Remove leading `.` from labels
func fixLabels(line string) (string, string) {

	label := ""

	if match := regexpLabel.FindStringSubmatch(line); len(match) > 0 {
		label = strings.Replace(match[1], ".", "", 1)
		line = label
		label = strings.Replace(label, ":", "", 1)
	}

	return line, label
}

// Make jmps uppercase
func upperCaseJumps(line string) (string, string, string) {

	instruction, label := "", ""

	if match := regexpJumpWithLabel.FindStringSubmatch(line); len(match) > 1 {
		// make jmp statement uppercase
		instruction = strings.ToUpper(match[1])
		label = strings.Replace(match[2], ".", "", 1)
		line = instruction + " " + label

	}

	return line, strings.TrimSpace(instruction), label
}

// Make calls uppercase
func upperCaseCalls(line string) (string, uint) {

	// TODO: Make determination of required stack size more sophisticated
	stackSize := uint(0)

	// Make 'call' instructions uppercase
	if match := regexpCall.FindStringSubmatch(line); len(match) > 0 {
		parts := strings.SplitN(line, `call`, 2)
		fname := strings.TrimSpace(parts[1])

		// replace c stdlib functions with equivalents
		if fname == "_memcpy" || fname == "memcpy@PLT" { // (Procedure Linkage Table)
			parts[1] = "clib·_memcpy(SB)"
			stackSize = 64
		} else if fname == "_memset" || fname == "memset@PLT" { // (Procedure Linkage Table)
			parts[1] = "clib·_memset(SB)"
			stackSize = 64
		} else if fname == "_floor" || fname == "floor@PLT" { // (Procedure Linkage Table)
			parts[1] = "clib·_floor(SB)"
			stackSize = 64
		} else if fname == "___bzero" {
			parts[1] = "clib·_bzero(SB)"
			stackSize = 64
		}
		line = parts[0] + "CALL " + strings.TrimSpace(parts[1])
	}

	return line, stackSize
}

func isLower(str string) bool {

	for _, r := range str {
		return unicode.IsLower(r)
	}
	return false
}

func removeUndefined(line, undef string) string {

	if parts := strings.SplitN(line, undef, 2); len(parts) > 1 {
		line = parts[0] + strings.TrimSpace(parts[1])
	}
	return line
}

func replaceUndefined(line, undef, repl string) string {

	if parts := strings.SplitN(line, undef, 2); len(parts) > 1 {
		line = parts[0] + repl + parts[1]
	}
	return line
}

// fix Position Independent Labels
func fixPicLabels(line string, table Table) string {

	if strings.Contains(line, "[rip + ") {
		parts := strings.SplitN(line, "[rip + ", 2)
		label := parts[1][:len(parts[1])-1]

		i := -1
		var l Label
		for i, l = range table.Labels {
			if l.Name == label {
				line = parts[0] + fmt.Sprintf("%d[rbp] /* [rip + %s */", l.Offset, parts[1])
				break
			}
		}
		if i == len(table.Labels) {
			panic(fmt.Sprintf("Failed to find label to replace of position independent code: %s", label))
		}
	}

	return line
}

func fixShiftNoArgument(line, ins string) string {

	if strings.Contains(line, ins) {
		parts := strings.SplitN(line, ins, 2)
		args := strings.SplitN(parts[1], ",", 2)
		if len(args) == 1 {
			line += ", 1"
		}
	}

	return line
}

func fixShiftInstructions(line string) string {

	line = fixShiftNoArgument(line, "shr")
	line = fixShiftNoArgument(line, "sar")

	return line
}

func fixMovabsInstructions(line string) string {

	if strings.Contains(line, "movabs") {
		parts := strings.SplitN(line, "movabs", 2)
		line = parts[0] + "mov" + parts[1]
	}

	return line
}

// Fix loads in the form of '[rbp + constant]'
// These are load instructions for stack-based arguments that occur after the first 6 arguments
// Remap to stack pointer
func fixRbpPlusLoad(line string, stackArgs StackArgs, stack Stack) string {

	if match := regexpRbpLoadHigher.FindStringSubmatch(line); len(match) > 1 {
		offset, _ := strconv.Atoi(match[1])
		// TODO: Get proper offset for non 64-bit arguments
		iarg := len(registers) + (offset-stackArgs.OffsetToFirst)/8
		parts := strings.SplitN(line, match[0], 2)
		line = parts[0] + fmt.Sprintf("%d[rsp]%s /* %s */", stack.OffsetForGoArg(iarg), parts[1], match[0])
	}

	return line
}

// Detect memory accesses in the form of '[rbp - constant]'
func detectRbpMinusMemoryAccess(line string) {

	if match := regexpRbpLoadLower.FindStringSubmatch(line); len(match) > 1 {

		panic(fmt.Sprintf("Not expected to find [rbp -] based loads: %s\n\nDid you specify `-mno-red-zone`?\n\n", line))
	}
}

// Detect jump tables
func detectJumpTable(line string) {

	if match := regexpJumpTableRef.FindStringSubmatch(line); len(match) > 0 {
		panic(fmt.Sprintf("Jump table detected: %s\n\nCircumvent using '-fno-jump-tables', see 'clang -cc1 -help' (version 3.9+)\n\n", match[1]))
	}
}

// Detect push instructions
func detectPushInstruction(line string) {

	if match := regexpPushInstr.FindStringSubmatch(line); len(match) > 0 {
		panic(fmt.Sprintf("push instruction detected: %s\n\nCannot modify `rsp` in body of assembly\n\n", match[1]))
	}
}

// Detect pop instructions
func detectPopInstruction(line string) {

	if match := regexpPopInstr.FindStringSubmatch(line); len(match) > 0 {
		panic(fmt.Sprintf("pop instruction detected: %s\n\nCannot modify `rsp` in body of assembly\n\n", match[1]))
	}
}
