// Copyright 2018 The CUE Authors
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

// Print sends text to the stdout of the current process.
Print: {
	$id: *"tool/cli.Print" | "print" // for backwards compatibility

	// text is the text to be printed.
	text: string
}

// Ask prompts the current console with a message and waits for input.
//
// Example:
//     task: ask: cli.Ask({
//         prompt:   "Are you okay?"
//         response: bool
//     })
Ask: {
	$id: "tool/cli.Ask"

	// prompt sends this message to the output.
	prompt: string

	// response holds the user's response. If it is a boolean expression it
	// will interpret the answer using textual yes/ no.
	response: string | bool
}
