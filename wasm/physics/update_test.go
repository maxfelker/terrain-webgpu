package physics

import (
	"math"
	"testing"
)

func flatGround(x, z float64) float64 { return 0 }

func TestMouseLook(t *testing.T) {
	p := &PlayerState{}
	Update(p, InputState{MouseDX: 1.0, MouseDY: 0}, 0.016, flatGround)
	if p.Yaw == 0 {
		t.Error("yaw should have changed")
	}
}

func TestPitchClamp(t *testing.T) {
	p := &PlayerState{}
	Update(p, InputState{MouseDY: 10000}, 0.016, flatGround)
	if p.Pitch > PitchMax {
		t.Errorf("pitch %f exceeds max %f", p.Pitch, PitchMax)
	}
	Update(p, InputState{MouseDY: -10000}, 0.016, flatGround)
	if p.Pitch < PitchMin {
		t.Errorf("pitch %f below min %f", p.Pitch, PitchMin)
	}
}

func TestGravity(t *testing.T) {
	// Start just above ground so player lands within 60 frames (~1s)
	p := &PlayerState{Y: 5}
	for range 60 {
		Update(p, InputState{}, 0.016, flatGround)
	}
	// Should have landed on ground (CapsuleHalfHeight + CapsuleRadius)
	expected := CapsuleHalfHeight + CapsuleRadius
	if p.Y < expected-0.01 || p.Y > expected+0.5 {
		t.Errorf("expected player near ground %f, got %f", expected, p.Y)
	}
	if !p.Grounded {
		t.Error("player should be grounded")
	}
}

func TestJump(t *testing.T) {
	p := &PlayerState{Y: CapsuleHalfHeight + CapsuleRadius, Grounded: true}
	Update(p, InputState{Jump: true}, 0.016, flatGround)
	if p.VelocityY <= 0 {
		t.Error("jump should give positive velocity")
	}
	if p.Grounded {
		t.Error("player should not be grounded immediately after jump")
	}
}

func TestSlopeBlocking(t *testing.T) {
	// Steep slope — terrain rises 10m over 1m horizontal = ~84 degrees
	steepGround := func(x, z float64) float64 { return x * 10.0 }
	p := &PlayerState{X: 0, Z: 0, Y: CapsuleHalfHeight + CapsuleRadius, Grounded: true}
	prevX := p.X
	Update(p, InputState{Forward: true}, 0.016, steepGround)
	// On 84 degree slope, movement should be blocked
	if p.X != prevX && p.X-prevX > 0.01 {
		t.Errorf("movement should be blocked on steep slope, moved %f", p.X-prevX)
	}
}

func TestFlyToggle_EntersAndExitsFlightMode(t *testing.T) {
	p := &PlayerState{X: 0, Y: 10, Z: 0}
	hf := func(x, z float64) float64 { return 0 }

	// Toggle on
	Update(p, InputState{FlyToggle: true}, 0.016, hf)
	if !p.Flying {
		t.Fatal("expected Flying=true after FlyToggle")
	}

	// Toggle off
	Update(p, InputState{FlyToggle: true}, 0.016, hf)
	if p.Flying {
		t.Fatal("expected Flying=false after second FlyToggle")
	}
}

func TestFlight_NoGravity(t *testing.T) {
	p := &PlayerState{X: 0, Y: 100, Z: 0, Flying: true}
	hf := func(x, z float64) float64 { return 0 }
	initialY := p.Y
	// No input, should hover in place (no gravity)
	Update(p, InputState{}, 0.1, hf)
	if math.Abs(p.Y-initialY) > 0.001 {
		t.Errorf("flying player should not fall: y changed from %.3f to %.3f", initialY, p.Y)
	}
}

func TestFlight_ForwardMovesInLookDirection(t *testing.T) {
	// Pitch up 45°, yaw 0 (facing -Z), press forward
	// Should move in -Z and +Y direction
	p := &PlayerState{X: 0, Y: 100, Z: 0, Flying: true, Yaw: 0, Pitch: math.Pi / 4}
	hf := func(x, z float64) float64 { return 0 }
	Update(p, InputState{Forward: true}, 1.0, hf)
	if p.Y <= 100 {
		t.Errorf("flying forward with pitch up should increase Y, got %.3f", p.Y)
	}
	if p.Z >= 0 {
		t.Errorf("flying forward with yaw=0 should decrease Z, got %.3f", p.Z)
	}
}

func TestFlight_SpeedIs10xWalk(t *testing.T) {
	if FlySpeed != WalkSpeed*10 {
		t.Errorf("FlySpeed should be 10x WalkSpeed: got %.1f, want %.1f", FlySpeed, WalkSpeed*10)
	}
}

