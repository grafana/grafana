# Copy textproto files in this directory from the source of truth.

SRC=$(GOPATH)/src/github.com/GoogleCloudPlatform/google-cloud-common/testing/firestore/testdata

.PHONY: refresh

refresh:
	-rm *.textproto
	cp $(SRC)/*.textproto .
	openssl dgst -sha1 $(SRC)/tests.binprotos > VERSION

