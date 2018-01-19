# Copyright 2017 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# snipmd inserts code snippets from Go source files into a markdown file.
#
# Call with one or more .go files and a .md file:
#
#    awk -f snipmd.awk foo.go bar.go template.md
#
# In the Go files, start a snippet with
#    //[ NAME
# and end it with
#    //]
#
# In the markdown, write
#    [snip]:# NAME
# to insert the snippet NAME just below that line.
# If there is already a code block after the [snip]:# line, it will be
# replaced, so a previous output can be used as input.
#
# The following transformations are made to the Go code:
# - The first tab of each line is removed.
# - Trailing blank lines are removed.
# - `ELLIPSIS` and `_ = ELLIPSIS` are replaced by `...` 


/^[ \t]*\/\/\[/ { # start snippet in Go file
  if (inGo()) {
    if ($2 == "") {
      die("missing snippet name")
    }
    curSnip = $2
    next
  }
}

/^[ \t]*\/\/]/ {  # end snippet in Go file
  if (inGo()) {
    if (curSnip != "") {
      # Remove all but one trailing newline.
      gsub(/\n+$/, "\n", snips[curSnip]) 
      curSnip = ""
      next
    } else {
      die("//] without corresponding //[")
    }
  }
}

ENDFILE {
  if (curSnip != "") {
    die("unclosed snippet: " curSnip)
  }
}

# Skip code blocks in the input that immediately follow [snip]:# lines,
# because we just inserted the snippet. Supports round-tripping.
/^```go$/,/^```$/ { 
  if (inMarkdown() && afterSnip) {
    next
  }
}

# Matches every line.
{
  if (curSnip != "") {
    line = $0
    # Remove initial tab, if any.
    if (line ~ /^\t/) {
      line = substr(line, 2)
    }
    # Replace ELLIPSIS.
    gsub(/_ = ELLIPSIS/, "...", line)
    gsub(/ELLIPSIS/, "...", line)

    snips[curSnip] = snips[curSnip]  line "\n"
  } else if (inMarkdown()) {
    afterSnip = 0 
    # Copy .md to output.
    print
  }
}

$1 ~ /\[snip\]:#/ {  # Snippet marker in .md file.
  if (inMarkdown()) {
    # We expect '[snip]:#' to be followed by  '(NAME)'
    if ($2 !~ /\(.*\)/) {
      die("bad snip spec: " $0)
    }
    name = substr($2, 2, length($2)-2)
    if (snips[name] == "") {
      die("no snippet named " name)
    }
    printf("```go\n%s```\n", snips[name])
    afterSnip = 1
  }
}


function inMarkdown() {
  return match(FILENAME, /\.md$/)
}

function inGo() {
  return match(FILENAME, /\.go$/)
}


function die(msg) {
  printf("%s:%d: %s\n", FILENAME, FNR, msg) > "/dev/stderr"
  exit 1
}
