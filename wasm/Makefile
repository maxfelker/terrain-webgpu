.PHONY: wasm test clean

GOVERSION := $(shell go version | awk '{print $$3}')

wasm:
	GOOS=js GOARCH=wasm go build -o ../public/terrain.wasm .
	@echo "Built terrain.wasm with $(GOVERSION)"

test:
	go test ./...

clean:
	rm -f ../public/terrain.wasm
