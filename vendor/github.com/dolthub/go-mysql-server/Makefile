# Package configuration
PROJECT = go-mysql-server
COMMANDS =
UNAME_S := $(shell uname -s)

# Including ci Makefile
CI_REPOSITORY ?= https://github.com/src-d/ci.git
CI_BRANCH ?= v1
CI_PATH ?= .ci
MAKEFILE := $(CI_PATH)/Makefile.main
$(MAKEFILE):
	git clone --quiet --depth 1 -b $(CI_BRANCH) $(CI_REPOSITORY) $(CI_PATH);
-include $(MAKEFILE)

integration:
	./_integration/run ${TEST}

oniguruma:
ifeq ($(UNAME_S),Linux)
	$(shell apt-get install libonig-dev)
endif

ifeq ($(UNAME_S),Darwin)
	$(shell brew install oniguruma)
endif

.PHONY: integration