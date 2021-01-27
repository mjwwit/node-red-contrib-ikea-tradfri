import * as t from 'io-ts'

export interface HueBrand {
  readonly Hue: unique symbol
}
export const hueType = t.brand(
  t.Int,
  (n): n is t.Branded<t.TypeOf<typeof t.Int>, HueBrand> => n >= 0 && n <= 360,
  'Hue'
)

export interface BrightnessBrand {
  readonly Brightness: unique symbol
}
export const brightnessType = t.brand(
  t.Int,
  (n): n is t.Branded<t.TypeOf<typeof t.Int>, BrightnessBrand> =>
    n >= 0 && n <= 100,
  'Brightness'
)

export interface SaturationBrand {
  readonly Saturation: unique symbol
}
export const saturationType = t.brand(
  t.Int,
  (n): n is t.Branded<t.TypeOf<typeof t.Int>, SaturationBrand> =>
    n >= 0 && n <= 100,
  'Saturation'
)
