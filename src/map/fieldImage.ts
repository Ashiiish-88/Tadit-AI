import type { Lut } from '@/lib/colormaps'

/**
 * A 256×256 offscreen canvas holding one colourised field. Values are interpolated in data
 * space between two frames (smooth playback), then mapped through the LUT.
 */
export class FieldImage {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private img: ImageData
  private px: Uint32Array
  private key = ''

  constructor(readonly n: number) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = n
    this.canvas.height = n
    this.ctx = this.canvas.getContext('2d')!
    this.img = this.ctx.createImageData(n, n)
    this.px = new Uint32Array(this.img.data.buffer)
  }

  render(
    key: string,
    a: Uint8Array,
    b: Uint8Array | null,
    f: number,
    lut: Lut,
    maskA: Uint8Array | null = null,
    maskB: Uint8Array | null = null,
  ) {
    if (key === this.key) return
    this.key = key
    const lut32 = new Uint32Array(lut.buffer, lut.byteOffset, 256)
    const px = this.px
    const N = a.length
    if (!b || f <= 0.001) {
      for (let i = 0; i < N; i++) px[i] = lut32[maskA && !maskA[i] ? 0 : a[i]]
    } else {
      for (let i = 0; i < N; i++) {
        const va = maskA && !maskA[i] ? 0 : a[i]
        const vb = maskB && !maskB[i] ? 0 : b[i]
        px[i] = lut32[(va + (vb - va) * f + 0.5) | 0]
      }
    }
    this.ctx.putImageData(this.img, 0, 0)
  }
}
