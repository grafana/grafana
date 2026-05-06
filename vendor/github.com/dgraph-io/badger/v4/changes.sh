#!/bin/bash

set -e
GHORG=${GHORG:-hypermodeinc}
GHREPO=${GHREPO:-badger}
cat <<EOF
This description was generated using this script:
\`\`\`sh
$(cat "$0")
\`\`\`
Invoked as:

    $(echo GHORG="${GHORG}" GHREPO="${GHREPO}" $(basename "$0") ${@:1})

EOF
git log --oneline --reverse ${@:1} |
	sed -E "s/^(\S{7}\s)//g" |
	sed -E "s/([\s|\(| ])#([0-9]+)/\1${GHORG}\/${GHREPO}#\2/g"
