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

	// 2. Determine speed
	speed := WalkSpeed
	p.Sprinting = false
	if input.Sprint && p.Stamina > 0 && (input.Forward || input.Backward || input.Left || input.Right) {
		speed = SprintSpeed
		p.Sprinting = true
		p.Stamina -= dt * (MaxStamina / (MaxStamina * 3)) // drain: 5 seconds to empty
		if p.Stamina < 0 {
			p.Stamina = 0
		}
	} else if p.Stamina < MaxStamina {
		p.Stamina += dt * (MaxStamina / (StaminaRecharge * MaxStamina)) // recharge
		if p.Stamina > MaxStamina {
			p.Stamina = MaxStamina
		}
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

	// 6. Jump
	if input.Jump && p.Grounded {
		p.VelocityY = JumpVelocity
		p.Grounded = false
	}

	// 7. Vertical integration
	p.Y += p.VelocityY * dt

	// 8. Ground collision — terrain height + capsule
	groundH := heightAt(p.X, p.Z) + CapsuleHalfHeight + CapsuleRadius
	if p.Y <= groundH {
		p.Y = groundH
		p.VelocityY = 0
		p.Grounded = true
	} else {
		p.Grounded = false
	}
}
