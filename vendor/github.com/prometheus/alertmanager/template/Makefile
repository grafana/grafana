DOCKER_IMG := altermanager-template
DOCKER_RUN_CURRENT_USER := docker run --user=$(shell id -u $(USER)):$(shell id -g $(USER))
DOCKER_CMD := $(DOCKER_RUN_CURRENT_USER) --rm -t -v $(PWD):/app -w /app $(DOCKER_IMG)

ifeq ($(NO_DOCKER), true)
	DOCKER_CMD=
endif

template-image:
	@(if [ "$(NO_DOCKER)" != "true" ] ; then \
		echo ">> build template docker image"; \
		docker build -t $(DOCKER_IMG) . > /dev/null; \
	fi; )

email.tmpl: template-image email.html
	@echo ">> inline css for html email template"
	$(DOCKER_CMD) ./inline-css.js
