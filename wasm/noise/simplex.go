package noise

import "math"

// Simplex2D returns a value in [-1, 1] for the given 2D coordinates.
func Simplex2D(x, z float64, seed int) float64 {
	const (
		F2 = 0.366025403784439
		G2 = 0.211324865405187
	)
	s := (x + z) * F2
	i := fastFloor(x + s)
	j := fastFloor(z + s)
	t := float64(i+j) * G2
	x0 := x - (float64(i) - t)
	z0 := z - (float64(j) - t)

	var i1, j1 int
	if x0 > z0 {
		i1, j1 = 1, 0
	} else {
		i1, j1 = 0, 1
	}

	x1 := x0 - float64(i1) + G2
	z1 := z0 - float64(j1) + G2
	x2 := x0 - 1 + 2*G2
	z2 := z0 - 1 + 2*G2

	n0 := cornerContrib(x0, z0, i, j, seed)
	n1 := cornerContrib(x1, z1, i+i1, j+j1, seed)
	n2 := cornerContrib(x2, z2, i+1, j+1, seed)

	return 70 * (n0 + n1 + n2)
}

// FBm layers multiple octaves of simplex noise.
func FBm(x, z float64, seed, octaves int, frequency, lacunarity, persistence float64) float64 {
	var sum, amp, maxAmp float64
	amp = 1.0
	freq := frequency
	for range octaves {
		sum += Simplex2D(x*freq, z*freq, seed) * amp
		maxAmp += amp
		amp *= persistence
		freq *= lacunarity
	}
	if maxAmp == 0 {
		return 0
	}
	return sum / maxAmp
}

// SkewXZ applies XZ skew rotation to reduce grid-alignment artifacts.
func SkewXZ(x, z float64) (float64, float64) {
	s := (x + z) * -0.211324865405187
	return x + s, z + s
}

func fastFloor(x float64) int {
	xi := int(x)
	if float64(xi) > x {
		return xi - 1
	}
	return xi
}

func cornerContrib(dx, dz float64, gi, gj, seed int) float64 {
	t := 0.5 - dx*dx - dz*dz
	if t < 0 {
		return 0
	}
	t *= t
	return t * t * grad2D(perm(gi, gj, seed), dx, dz)
}

func perm(i, j, seed int) int {
	h := seed ^ (i * 1619) ^ (j * 31337)
	h ^= h >> 16
	h *= 0x45d9f3b
	h ^= h >> 16
	return h & 0xFF
}

func grad2D(hash int, x, z float64) float64 {
	h := hash & 7
	u, v := x, z
	if h >= 4 {
		u, v = z, x
	}
	if h&1 != 0 {
		u = -u
	}
	if h&2 != 0 {
		v = -v
	}
	return u + v
}

// Clamp returns x clamped to [min, max].
func Clamp(x, min, max float64) float64 {
	return math.Max(min, math.Min(max, x))
}
