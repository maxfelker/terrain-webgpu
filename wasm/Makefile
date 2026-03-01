.PHONY: wasm test test-short clean

GOVERSION := $(shell go version | awk '{print $$3}')

wasm:
	GOOS=js GOARCH=wasm go build -o ../public/terrain.wasm .
	@echo "Built terrain.wasm with $(GOVERSION)"

test:
	go test ./... -v -count=1

test-short:
	go test ./... -short

clean:
	rm -f ../public/terrain.wasm
