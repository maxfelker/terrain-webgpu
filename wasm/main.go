//go:build js && wasm

package main

import (
	"fmt"
	"syscall/js"
)

func main() {
	fmt.Println("[WASM] terrain engine starting...")

	// Register all exported functions
	js.Global().Set("go_ping", js.FuncOf(goPing))

	fmt.Println("[WASM] exports registered, engine ready")

	// Keep the Go runtime alive
	select {}
}

func goPing(this js.Value, args []js.Value) any {
	return "pong"
}
