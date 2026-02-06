// Copyright 2019 The CUE Authors
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

package os

// A Value are all possible values allowed in flags.
// A null value unsets an environment variable.
Value: bool | number | *string | null

// Name indicates a valid flag name.
Name: !="" & !~"^[$]"

// Setenv defines a set of command line flags, the values of which will be set
// at run time. The doc comment of the flag is presented to the user in help.
//
// To define a shorthand, define the shorthand as a new flag referring to
// the flag of which it is a shorthand.
Setenv: {
	$id: "tool/os.Setenv"

	{[Name]: Value}
}

// Getenv gets and parses the specific command line variables.
Getenv: {
	$id: "tool/os.Getenv"

	{[Name]: Value}
}

// Environ populates a struct with all environment variables.
Environ: {
	$id: "tool/os.Environ"

	// A map of all populated values.
	// Individual entries may be specified ahead of time to enable
	// validation and parsing. Values that are marked as required
	// will fail the task if they are not found.
	{[Name]: Value}
}

// Clearenv clears all environment variables.
Clearenv: {
	$id: "tool/os.Clearenv"
}
