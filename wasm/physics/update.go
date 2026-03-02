package physics

import "math"

// Update advances the player simulation by dt seconds given input.
// heightAt is a callback that returns terrain height at world (x, z).
func Update(p *PlayerState, input InputState, dt float64, heightAt func(x, z float64) float64) {
	// 1. Mouse look
	p.Yaw -= input.MouseDX * Sensitivity
	p.Pitch -= input.MouseDY * Sensitivity
	if p.Pitch < PitchMin {
		p.Pitch = PitchMin
	}
	if p.Pitch > PitchMax {
		p.Pitch = PitchMax
	}

	// Toggle flight mode on FlyToggle input
	if input.FlyToggle {
		p.Flying = !p.Flying
		if p.Flying {
			// Enter flight: kill vertical velocity, don't snap to ground
			p.VelocityY = 0
		} else {
			// Exit flight: let gravity take over from current position
			p.VelocityY = 0
			p.Grounded = false
		}
	}

	if p.Flying {
		// FLIGHT MODE: drone-style, moves in the full 3D look direction
		speed := FlySpeed
		// Sprint in flight = 2x fly speed
		p.Sprinting = false
		if input.Sprint {
			speed *= 2
			p.Sprinting = true
		}

		sinYaw := math.Sin(p.Yaw)
		cosYaw := math.Cos(p.Yaw)
		cosPitch := math.Cos(p.Pitch)
		sinPitch := math.Sin(p.Pitch)

		// Forward/backward moves in the full look direction (including vertical component)
		if input.Forward {
			p.X -= sinYaw * cosPitch * speed * dt
			p.Y += sinPitch * speed * dt
			p.Z -= cosYaw * cosPitch * speed * dt
		}
		if input.Backward {
			p.X += sinYaw * cosPitch * speed * dt
			p.Y -= sinPitch * speed * dt
			p.Z += cosYaw * cosPitch * speed * dt
		}
		// Strafing is purely horizontal
		if input.Left {
			p.X -= cosYaw * speed * dt
			p.Z += sinYaw * speed * dt
		}
		if input.Right {
			p.X += cosYaw * speed * dt
			p.Z -= sinYaw * speed * dt
		}
		// Jump key ascends directly
		if input.Jump {
			p.Y += speed * dt
		}
		// No gravity, no ground collision in flight mode
		p.VelocityY = 0
		p.Grounded = false
		p.CoyoteFrames = 0
	} else {
		// GROUND MODE: existing code unchanged
		// 2. Determine speed
		speed := WalkSpeed
		p.Sprinting = false
		if input.Sprint && (input.Forward || input.Backward || input.Left || input.Right) {
			speed = SprintSpeed
			p.Sprinting = true
		}

		// 3. Horizontal movement in yaw-facing direction
		sin := math.Sin(p.Yaw)
		cos := math.Cos(p.Yaw)
		var dx, dz float64
		if input.Forward {
			dx -= sin * speed * dt
			dz -= cos * speed * dt
		}
		if input.Backward {
			dx += sin * speed * dt
			dz += cos * speed * dt
		}
		if input.Left {
			dx -= cos * speed * dt
			dz += sin * speed * dt
		}
		if input.Right {
			dx += cos * speed * dt
			dz -= sin * speed * dt
		}

		// 4. Slope check — sample terrain ahead, block if slope > SlopeLimit
		newX := p.X + dx
		newZ := p.Z + dz
		curH := heightAt(p.X, p.Z)
		nextH := heightAt(newX, newZ)
		moveLen := math.Sqrt(dx*dx + dz*dz)
		if moveLen > 0 {
			slopeAngle := math.Atan2(math.Abs(nextH-curH), moveLen) * 180.0 / math.Pi
			if slopeAngle <= SlopeLimit {
				p.X = newX
				p.Z = newZ
			}
		} else {
			p.X = newX
			p.Z = newZ
		}

		// 5. Gravity
		p.VelocityY += Gravity * dt

		// 6. Jump initiation — sets JumpProgress to begin smooth ramp
		if input.Jump && p.Grounded && p.JumpProgress == 0 {
			p.JumpProgress = 1.0
			p.Grounded = false
			p.CoyoteFrames = CoyoteGrace + 1 // skip coyote grace so we don't re-land
		}

		// 6a. Smooth jump ramp — lerp VelocityY toward JumpVelocity over ~3 frames
		if p.JumpProgress > 0 {
			p.VelocityY += (JumpVelocity - p.VelocityY) * 0.5
			p.JumpProgress -= 0.35
			if p.JumpProgress < 0 {
				p.JumpProgress = 0
			}
		}

		// 7. Vertical integration
		p.Y += p.VelocityY * dt

		// 8. Ground collision with coyote-time to prevent airborne flicker on micro-bumps
		groundH := heightAt(p.X, p.Z) + CapsuleHalfHeight + CapsuleRadius
		if p.Y <= groundH && p.JumpProgress == 0 {
			p.Y = groundH
			p.VelocityY = 0
			p.Grounded = true
			p.CoyoteFrames = 0
		} else if p.Y > groundH {
			if p.Grounded && p.CoyoteFrames < CoyoteGrace && p.JumpProgress == 0 {
				// Grace period: keep grounded for a few ticks after leaving ground
				p.CoyoteFrames++
			} else {
				p.Grounded = false
				p.CoyoteFrames = 0
			}
		}
	}
}
