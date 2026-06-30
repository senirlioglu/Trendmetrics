# 🕊️ Flock Runner

Count Masters tarzı **kuş sürüsü koşu (flock runner)** oyunu. Kuşbakışı
(top-down), dikey scroll. **Next.js (App Router) + TypeScript + Canvas 2D**,
sıfır harici oyun bağımlılığı. Tüm oyun mantığı tek client component'tedir
(`app/Game.tsx`).

## Mekanik

- **İleri hız sabit** — oyuncu yalnızca yatay (X) hareketi kontrol eder.
  Sürü ekranın alt-orta kısmında kalır, zemin yukarı akar.
- **Kontrol:** mouse/dokunmatik sürükleme + sol/sağ ok tuşları. Sürü merkezi
  imlecin X konumunu yumuşak damping (lerp) ile takip eder.
- **Kapılar (gate):** ikili sol/sağ. İşlemler `+5`, `x2`, `-3`... Yeşil artırır,
  kırmızı azaltır. Hangi taraftan geçersen o uygulanır. Lider kuşun üstünde
  her zaman görünen büyük sayaç.
- **Engeller:** fırtına bulutu / atmaca / elektrik teli — sürünün bir kısmını
  eler. Telde yalnızca boşluktan geçilir; bulut/atmaca bandından kaçılır.
  Sayı 0'a inerse oyun biter.
- **Boss:** level sonunda düşman kuş sürüsü. Sayın büyükse kazanır, tüy
  patlamasıyla bir sonraki level'a geçersin.
- **Juice:** camera shake, partikül patlaması, kırmızı kapı/çarpmada
  `navigator.vibrate(50)`.
- High score `localStorage`'da tutulur. Tap-to-start + game over / restart.
  Tamamen mobil-uyumlu (portrait, tek elle).

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:3000
# veya
npm run build && npm run start
```

## Dosya yapısı

- `app/page.tsx` — tap-to-start + mount (Game'i `ssr:false` ile yükler).
- `app/Game.tsx` — tüm oyun mantığı (state, input, rAF döngüsü, Canvas çizimi).
- `app/layout.tsx`, `app/globals.css` — kabuk ve mobil-uyumlu stiller.
