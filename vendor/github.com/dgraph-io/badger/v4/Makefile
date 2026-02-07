#
# SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
# SPDX-License-Identifier: Apache-2.0
#

USER_ID      = $(shell id -u)
HAS_JEMALLOC = $(shell test -f /usr/local/lib/libjemalloc.a && echo "jemalloc")
JEMALLOC_URL = "https://github.com/jemalloc/jemalloc/releases/download/5.2.1/jemalloc-5.2.1.tar.bz2"


.PHONY: all badger test jemalloc dependency

badger: jemalloc
	@echo "Compiling Badger binary..."
	@$(MAKE) -C badger badger
	@echo "Badger binary located in badger directory."

test: jemalloc
	@echo "Running Badger tests..."
	@./test.sh

jemalloc:
	@if [ -z "$(HAS_JEMALLOC)" ] ; then \
		mkdir -p /tmp/jemalloc-temp && cd /tmp/jemalloc-temp ; \
		echo "Downloading jemalloc..." ; \
		curl -s -L ${JEMALLOC_URL} -o jemalloc.tar.bz2 ; \
		tar xjf ./jemalloc.tar.bz2 ; \
		cd jemalloc-5.2.1 ; \
		./configure --with-jemalloc-prefix='je_' --with-malloc-conf='background_thread:true,metadata_thp:auto'; \
		make ; \
		if [ "$(USER_ID)" -eq "0" ]; then \
			make install ; \
		else \
			echo "==== Need sudo access to install jemalloc" ; \
			sudo make install ; \
		fi \
	fi

dependency:
	@echo "Installing dependencies..."
	@sudo apt-get update
	@sudo apt-get -y install \
    	ca-certificates \
    	curl \
    	gnupg \
    	lsb-release \
    	build-essential \
    	protobuf-compiler \
