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

# snipdoc merges code snippets from Go source files into a template to
# produce another go file (typically doc.go).
#
# Call with one or more .go files and a template file.
#
#    awk -f snipmd.awk foo.go bar.go doc.template
#
# In the Go files, start a snippet with
#    //[ NAME
# and end it with
#    //]
#
# In the template, write
#    [NAME]
# on a line by itself to insert the snippet NAME on that line.
#
# The following transformations are made to the Go code:
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
      # Remove all trailing newlines.
      gsub(/[\t\n]+$/, "", snips[curSnip])
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

/^\[.*\]$/ { # Snippet marker in template file.
  if (inTemplate()) {
    name = substr($1, 2, length($1)-2)
    if (snips[name] == "") {
      die("no snippet named " name)
    }
    printf("%s\n", snips[name])
    afterSnip = 1
    next
  }
}

# Matches every line.
{
  if (curSnip != "") {
    # If the first line in the snip has no indent, add the indent.
    if (snips[curSnip] == "") {
      if (index($0, "\t") == 1) {
        extraIndent = ""
      } else {
        extraIndent = "\t"
      }
    }

    line = $0
    # Replace ELLIPSIS.
    gsub(/_ = ELLIPSIS/, "...", line)
    gsub(/ELLIPSIS/, "...", line)

    snips[curSnip] = snips[curSnip] extraIndent line "\n"
  } else if (inTemplate()) {
    afterSnip = 0
    # Copy to output.
    print
  }
}



function inTemplate() {
  return match(FILENAME, /\.template$/)
}

function inGo() {
  return match(FILENAME, /\.go$/)
}


function die(msg) {
  printf("%s:%d: %s\n", FILENAME, FNR, msg) > "/dev/stderr"
  exit 1
}
