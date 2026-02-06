#!/usr/bin/env bash

set -e

install_mac() {
	command -v brew >/dev/null ||
		{
			echo "[ERROR]: 'brew' command not not found. Exiting" 1>&2
			exit 1
		}
	brew install flatbuffers
}

install_linux() {
	for CMD in curl cmake g++ make; do
		command -v "${CMD}" >/dev/null ||
			{
				echo "[ERROR]: '${CMD}' command not not found. Exiting" 1>&2
				exit 1
			}
	done

	## Create Temp Build Directory
	BUILD_DIR=$(mktemp -d)
	pushd "${BUILD_DIR}"

	## Fetch Latest Tarball
	LATEST_VERSION=$(curl -s https://api.github.com/repos/google/flatbuffers/releases/latest | grep -oP '(?<=tag_name": ")[^"]+')
	curl -sLO https://github.com/google/flatbuffers/archive/"${LATEST_VERSION}".tar.gz
	tar xf "${LATEST_VERSION}".tar.gz

	## Build Binaries
	cd flatbuffers-"${LATEST_VERSION#v}"
	cmake -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release
	make
	./flattests
	cp flatc /usr/local/bin/flatc

	## Cleanup Temp Build Directory
	popd
	rm -rf "${BUILD_DIR}"
}

SYSTEM=$(uname -s)

case ${SYSTEM,,} in
linux)
	sudo bash -c "$(declare -f install_linux); install_linux"
	;;
darwin)
	install_mac
	;;
esac
