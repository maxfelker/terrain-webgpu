package physics

import "testing"

func flatGround(x, z float64) float64 { return 0 }

func TestMouseLook(t *testing.T) {
	p := &PlayerState{Stamina: MaxStamina}
	Update(p, InputState{MouseDX: 1.0, MouseDY: 0}, 0.016, flatGround)
	if p.Yaw == 0 {
		t.Error("yaw should have changed")
	}
}

func TestPitchClamp(t *testing.T) {
	p := &PlayerState{Stamina: MaxStamina}
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
	p := &PlayerState{Y: 5, Stamina: MaxStamina}
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
	p := &PlayerState{Y: CapsuleHalfHeight + CapsuleRadius, Grounded: true, Stamina: MaxStamina}
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
	p := &PlayerState{X: 0, Z: 0, Y: CapsuleHalfHeight + CapsuleRadius, Grounded: true, Stamina: MaxStamina}
	prevX := p.X
	Update(p, InputState{Forward: true}, 0.016, steepGround)
	// On 84 degree slope, movement should be blocked
	if p.X != prevX && p.X-prevX > 0.01 {
		t.Errorf("movement should be blocked on steep slope, moved %f", p.X-prevX)
	}
}

func TestSprintDrainsStamina(t *testing.T) {
	p := &PlayerState{Stamina: MaxStamina, Grounded: true, Y: CapsuleHalfHeight + CapsuleRadius}
	initial := p.Stamina
	for range 60 {
		Update(p, InputState{Forward: true, Sprint: true}, 0.016, flatGround)
	}
	if p.Stamina >= initial {
		t.Error("stamina should drain when sprinting")
	}
}

func TestStaminaRecharges(t *testing.T) {
	p := &PlayerState{Stamina: 0}
	for range 60 {
		Update(p, InputState{}, 0.016, flatGround)
	}
	if p.Stamina <= 0 {
		t.Error("stamina should recharge when not sprinting")
	}
}
