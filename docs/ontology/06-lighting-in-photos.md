# 06 Lighting in photographs

Only **pixel statistics**; no recognition of what is in the photo (`README`, out of scope).

## Teal–orange grade (`lighting.teal-orange`)

[AUDIT: experiment E5] The rule:
- **shadows:** the share-weighted mean hue of pixels with L < 0.4 lies in 170–240°, with a mean chroma offset ≥ 0.02;
- **highlights:** the mean hue of pixels with L > 0.65 lies in 35–85°, with a mean chroma offset ≥ 0.02.

On synthetic scenes:
- a graded scene gives shadow hue 208° and highlight hue 55°, with offsets 0.026 and 0.033;
- **orange objects under neutral light** are not detected (the shadows stay neutral);
- a **warm-only cast** is not detected (the shadows are warm too);
- a weak grade (0.025 before mixing) is below the detection limit.

[UNDERSTANDING] The threshold separates a grade from orange objects because a grade moves **both** ends of the tone range in opposite directions. Real photographs still need testing (#62).

## White-balance cast (`lighting.white-balance-cast`)

[UNDERSTANDING] Two tests; report the cast only if both agree:
- **grey world:** the share-weighted mean a, b of all pixels is offset from 0 by ≥ 0.01;
- **near-neutrals:** pixels with C < 0.04 have a mean offset in the same direction.

Reported as a hue and a size. It always carries the caveat `lighting-confound`, since a scene can be mostly one colour (a forest, a beach).

## Split toning, duotone, sepia

| Kind | Test [UNDERSTANDING] |
|---|---|
| `lighting.split-toning` | Like teal–orange, with any two hues: shadow and highlight mean hues differ by ≥ 90°, each offset ≥ 0.02 |
| `lighting.duotone` | All pixels lie near a single path between two colours in OKLab (collinear, ε 0.02); a gradient map |
| `lighting.sepia` | All pixels have hue 50–80° and C ≤ 0.06, with L spread over the range; monochrome toning |

## Harmonies in photographs

[UNDERSTANDING] Lighting shifts every colour, so structures found in photos carry `lighting-confound` and lower confidence. A cast can hide a harmony by pulling all hues one way, and a grade can create a false complementary (teal–orange is one). See `11`.

## Not detectable without ML

Golden hour vs an orange object, skin tones, sky or vegetation, indoor vs outdoor light, and the time of day.
