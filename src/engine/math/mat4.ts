// Column-major 4x4 matrix math for WebGPU (NDC z in [0,1])
export type Mat4 = Float32Array

function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1.0 / Math.tan(fovY / 2)
  const nf = 1 / (near - far)
  return new Float32Array([
    f / aspect, 0, 0,  0,
    0,          f, 0,  0,
    0,          0, far * nf,        -1,
    0,          0, near * far * nf,  0,
  ])
}

function lookAt(
  eye: [number, number, number],
  center: [number, number, number],
  up: [number, number, number],
): Mat4 {
  const fx = center[0] - eye[0]
  const fy = center[1] - eye[1]
  const fz = center[2] - eye[2]
  const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz)
  const fnx = fx / fLen, fny = fy / fLen, fnz = fz / fLen

  const rx = fny * up[2] - fnz * up[1]
  const ry = fnz * up[0] - fnx * up[2]
  const rz = fnx * up[1] - fny * up[0]
  const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz)
  const rnx = rx / rLen, rny = ry / rLen, rnz = rz / rLen

  const ux = rny * fnz - rnz * fny
  const uy = rnz * fnx - rnx * fnz
  const uz = rnx * fny - rny * fnx

  // Column-major layout
  return new Float32Array([
    rnx,                              ux,                              -fnx, 0,
    rny,                              uy,                              -fny, 0,
    rnz,                              uz,                              -fnz, 0,
    -(rnx * eye[0] + rny * eye[1] + rnz * eye[2]),
    -(ux  * eye[0] + uy  * eye[1] + uz  * eye[2]),
     (fnx * eye[0] + fny * eye[1] + fnz * eye[2]),
    1,
  ])
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k]
      }
      out[col * 4 + row] = sum
    }
  }
  return out
}

export default { perspective, lookAt, multiply }
