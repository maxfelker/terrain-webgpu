package physics

import "math"

const (
	CapsuleRadius     = 0.35
	CapsuleHalfHeight = 0.9
	EyeHeight         = 0.8
	Gravity           = -19.62
	WalkSpeed         = 7.5
	SprintSpeed       = 20.0
	JumpVelocity      = 6.26 // sqrt(2 * 9.81 * 2.0) ≈ 6.26
	SlopeLimit        = 65.0 // degrees
	Sensitivity       = 0.002
	PitchMin          = -math.Pi / 2.0 * 0.99
	PitchMax          = math.Pi / 180.0 * 70.0
	CheckDistance     = 0.4
	CoyoteGrace       = 4 // physics ticks of grace before declaring airborne
)

type InputState struct {
	Forward  bool    `json:"forward"`
	Backward bool    `json:"backward"`
	Left     bool    `json:"left"`
	Right    bool    `json:"right"`
	Jump     bool    `json:"jump"`
	Sprint   bool    `json:"sprint"`
	MouseDX  float64 `json:"mouseDX"`
	MouseDY  float64 `json:"mouseDY"`
}

type PlayerState struct {
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	Z            float64 `json:"z"`
	Yaw          float64 `json:"yaw"`
	Pitch        float64 `json:"pitch"`
	VelocityY    float64 `json:"velocityY"`
	Grounded     bool    `json:"grounded"`
	Sprinting    bool    `json:"sprinting"`
	CoyoteFrames int     `json:"coyoteFrames"`
	JumpProgress float64 `json:"jumpProgress"`
}
