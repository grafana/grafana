#!/bin/bash

# Run all the different permutations of all the tests and other things
# This helps ensure that nothing gets broken.

_tests() {
    local gover=$( go version | cut -f 3 -d ' ' )
    local a=( "" "codecgen" )
    for i in "${a[@]}"
    do
        echo ">>>> TAGS: $i"
        local i2=${i:-default}
        case $gover in
            go1.[0-6]*) go vet -printfuncs "errorf" "$@" &&
                              go test ${zargs[*]} -vet off -tags "$i" "$@" ;;
            *) go vet -printfuncs "errorf" "$@" &&
                     go test ${zargs[*]} -vet off -tags "alltests $i" -run "Suite" -coverprofile "${i2// /-}.cov.out" "$@" ;;
        esac
        if [[ "$?" != 0 ]]; then return 1; fi
    done
    echo "++++++++ TEST SUITES ALL PASSED ++++++++"
}


# is a generation needed?
_ng() {
    local a="$1"
    if [[ ! -e "$a" ]]; then echo 1; return; fi
    for i in `ls -1 *.go.tmpl gen.go values_test.go`
    do
        if [[ "$a" -ot "$i" ]]; then echo 1; return; fi
    done
}

_prependbt() {
    cat > ${2} <<EOF
// +build generated

EOF
    cat ${1} >> ${2}
    rm -f ${1}
}

# _build generates gen-helper.go.
_build() {
    if ! [[ "${zforce}" || $(_ng "gen-helper.generated.go") || $(_ng "gen.generated.go") ]]; then return 0; fi

    if [ "${zbak}" ]; then
        _zts=`date '+%m%d%Y_%H%M%S'`
        _gg=".generated.go"
        [ -e "gen-helper${_gg}" ] && mv gen-helper${_gg} gen-helper${_gg}__${_zts}.bak
        [ -e "gen${_gg}" ] && mv gen${_gg} gen${_gg}__${_zts}.bak
    fi
    rm -f gen-helper.generated.go gen.generated.go \
       *_generated_test.go *.generated_ffjson_expose.go

    cat > gen.generated.go <<EOF
// +build codecgen.exec

// Copyright (c) 2012-2018 Ugorji Nwoke. All rights reserved.
// Use of this source code is governed by a MIT license found in the LICENSE file.

package codec

// DO NOT EDIT. THIS FILE IS AUTO-GENERATED FROM gen-dec-(map|array).go.tmpl

const genDecMapTmpl = \`
EOF
    cat >> gen.generated.go < gen-dec-map.go.tmpl
    cat >> gen.generated.go <<EOF
\`

const genDecListTmpl = \`
EOF
    cat >> gen.generated.go < gen-dec-array.go.tmpl
    cat >> gen.generated.go <<EOF
\`

const genEncChanTmpl = \`
EOF
    cat >> gen.generated.go < gen-enc-chan.go.tmpl
    cat >> gen.generated.go <<EOF
\`
EOF
    cat > gen-from-tmpl.codec.generated.go <<EOF
package codec
import "io"
func GenInternalGoFile(r io.Reader, w io.Writer) error {
return genInternalGoFile(r, w)
}
EOF
    cat > gen-from-tmpl.generated.go <<EOF
//+build ignore

package main

import "${zpkg}"
import "os"

func run(fnameIn, fnameOut string) {
println("____ " + fnameIn + " --> " + fnameOut + " ______")
fin, err := os.Open(fnameIn)
if err != nil { panic(err) }
defer fin.Close()
fout, err := os.Create(fnameOut)
if err != nil { panic(err) }
defer fout.Close()
err = codec.GenInternalGoFile(fin, fout)
if err != nil { panic(err) }
}

func main() {
run("gen-helper.go.tmpl", "gen-helper.generated.go")
run("mammoth-test.go.tmpl", "mammoth_generated_test.go")
run("mammoth2-test.go.tmpl", "mammoth2_generated_test.go")
}
EOF

    sed -e 's+// __DO_NOT_REMOVE__NEEDED_FOR_REPLACING__IMPORT_PATH__FOR_CODEC_BENCH__+import . "github.com/hashicorp/go-msgpack/v2/codec"+' \
        shared_test.go > bench/shared_test.go

    # explicitly return 0 if this passes, else return 1
    go run -tags "codecgen.exec" gen-from-tmpl.generated.go &&
        rm -f gen-from-tmpl.*generated.go &&
        return 0
    return 1
}

_codegenerators() {
    local c5="_generated_test.go"
    local c7="$PWD/codecgen"
    local c8="$c7/__codecgen"
    local c9="codecgen-scratch.go"

    if ! [[ $zforce || $(_ng "values_codecgen${c5}") ]]; then return 0; fi

    # Note: ensure you run the codecgen for this codebase/directory i.e. ./codecgen/codecgen
    true &&
        echo "codecgen ... " &&
        if [[ $zforce || ! -f "$c8" || "$c7/gen.go" -nt "$c8" ]]; then
            echo "rebuilding codecgen ... " && ( cd codecgen && go build -o $c8 ${zargs[*]} . )
        fi &&
        $c8 -rt codecgen -t 'codecgen generated' -o values_codecgen${c5} -d 19780 $zfin $zfin2 &&
        cp mammoth2_generated_test.go $c9 &&
        $c8 -o mammoth2_codecgen${c5} -d 19781 mammoth2_generated_test.go &&
        rm -f $c9 &&
        echo "generators done!"
}

_prebuild() {
    echo "prebuild: zforce: $zforce"
    local d="$PWD"
    zfin="test_values.generated.go"
    zfin2="test_values_flex.generated.go"
    zpkg="github.com/hashicorp/go-msgpack/v2/codec"
    # zpkg=${d##*/src/}
    # zgobase=${d%%/src/*}
    # rm -f *_generated_test.go
    rm -f codecgen-*.go &&
        _build &&
        cp $d/values_test.go $d/$zfin &&
        cp $d/values_flex_test.go $d/$zfin2 &&
        _codegenerators &&
        if [[ "$(type -t _codegenerators_external )" = "function" ]]; then _codegenerators_external ; fi &&
        if [[ $zforce ]]; then go install ${zargs[*]} .; fi &&
        echo "prebuild done successfully"
    rm -f $d/$zfin $d/$zfin2
    unset zfin zfin2 zpkg
}

_make() {
    zforce=1
    (cd codecgen && go install ${zargs[*]} .) && _prebuild && go install ${zargs[*]} .
    unset zforce
}

_clean() {
    rm -f gen-from-tmpl.*generated.go \
       codecgen-*.go \
       test_values.generated.go test_values_flex.generated.go
}

_release() {
    local reply
    read -p "Pre-release validation takes a few minutes and MUST be run from within GOPATH/src. Confirm y/n? " -n 1 -r reply
    echo
    if [[ ! $reply =~ ^[Yy]$ ]]; then return 1; fi

    # expects GOROOT, GOROOT_BOOTSTRAP to have been set.
    if [[ -z "${GOROOT// }" || -z "${GOROOT_BOOTSTRAP// }" ]]; then return 1; fi
    # (cd $GOROOT && git checkout -f master && git pull && git reset --hard)
    (cd $GOROOT && git pull)
    local f=`pwd`/make.release.out
    cat > $f <<EOF
========== `date` ===========
EOF
    # # go 1.6 and below kept giving memory errors on Mac OS X during SDK build or go run execution,
    # # that is fine, as we only explicitly test the last 3 releases and tip (2 years).
    zforce=1
    for i in 1.10 1.11 1.12 master
    do
        echo "*********** $i ***********" >>$f
        if [[ "$i" != "master" ]]; then i="release-branch.go$i"; fi
        (false ||
             (echo "===== BUILDING GO SDK for branch: $i ... =====" &&
                  cd $GOROOT &&
                  git checkout -f $i && git reset --hard && git clean -f . &&
                  cd src && ./make.bash >>$f 2>&1 && sleep 1 ) ) &&
            echo "===== GO SDK BUILD DONE =====" &&
            _prebuild &&
            echo "===== PREBUILD DONE with exit: $? =====" &&
            _tests "$@"
        if [[ "$?" != 0 ]]; then return 1; fi
    done
    unset zforce
    echo "++++++++ RELEASE TEST SUITES ALL PASSED ++++++++"
}

_usage() {
    cat <<EOF
primary usage: $0
    -[tmpfxnld]           -> [tests, make, prebuild (force) (external), inlining diagnostics, mid-stack inlining, race detector]
    -v                    -> verbose
EOF
    if [[ "$(type -t _usage_run)" = "function" ]]; then _usage_run ; fi
}

_main() {
    if [[ -z "$1" ]]; then _usage; return 1; fi
    local x
    unset zforce
    zargs=()
    zbenchflags=""
    OPTIND=1
    while getopts ":ctmnrgpfvlzdb:" flag
    do
        case "x$flag" in
            'xf') zforce=1 ;;
            'xv') zverbose=1 ;;
            'xl') zargs+=("-gcflags"); zargs+=("-l=4") ;;
            'xn') zargs+=("-gcflags"); zargs+=("-m=2") ;;
            'xd') zargs+=("-race") ;;
            'xb') x='b'; zbenchflags=${OPTARG} ;;
            x\?) _usage; return 1 ;;
            *) x=$flag ;;
        esac
    done
    shift $((OPTIND-1))
    # echo ">>>> _main: extra args: $@"
    case "x$x" in
        'xt') _tests "$@" ;;
        'xm') _make "$@" ;;
        'xr') _release "$@" ;;
        'xg') _go ;;
        'xp') _prebuild "$@" ;;
        'xc') _clean "$@" ;;
        'xz') _analyze "$@" ;;
        'xb') _bench "$@" ;;
    esac
    unset zforce zargs zbenchflags
}

[ "." = `dirname $0` ] && _main "$@"