// Marching squares on a Uint8 grid → Path2D in grid-index units (x = column, y = row).

export function contourPath(data: Uint8Array, n: number, level: number, mask?: (idx: number) => boolean): Path2D {
  const path = new Path2D()
  const v = (i: number, j: number) => {
    const idx = j * n + i
    return mask && !mask(idx) ? 0 : data[idx]
  }
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = v(i, j)
      const b = v(i + 1, j)
      const c = v(i + 1, j + 1)
      const d = v(i, j + 1)
      const code = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0)
      if (code === 0 || code === 15) continue
      const t = (p: number, q: number) => (p === q ? 0.5 : (level - p) / (q - p))
      const top: [number, number] = [i + t(a, b), j]
      const right: [number, number] = [i + 1, j + t(b, c)]
      const bottom: [number, number] = [i + t(d, c), j + 1]
      const left: [number, number] = [i, j + t(a, d)]
      const seg = (p: [number, number], q: [number, number]) => {
        path.moveTo(p[0], p[1])
        path.lineTo(q[0], q[1])
      }
      switch (code) {
        case 1:
        case 14:
          seg(left, bottom)
          break
        case 2:
        case 13:
          seg(bottom, right)
          break
        case 3:
        case 12:
          seg(left, right)
          break
        case 4:
        case 11:
          seg(top, right)
          break
        case 5:
          seg(left, top)
          seg(bottom, right)
          break
        case 6:
        case 9:
          seg(top, bottom)
          break
        case 7:
        case 8:
          seg(left, top)
          break
        case 10:
          seg(left, bottom)
          seg(top, right)
          break
      }
    }
  }
  return path
}
