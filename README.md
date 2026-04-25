# StockPulse

Análisis inteligente de acciones en segundos — para el inversor hispanoparlante.

## Stack

- **Next.js 14** + Tailwind CSS
- **Polygon.io** — datos de mercado (precio, MA50/200, RSI, MACD, noticias)
- **Anthropic Claude** — narrativa de análisis en español
- Deploy en **Vercel** (recomendado)

---

## Setup local en 5 minutos

### 1. Clonar e instalar

```bash
git clone <tu-repo>
cd stockpulse
npm install
```

### 2. Correr en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000)

### 3. Configurar tus API keys

Abrí la app y andá a **⚙ API Keys** en el menú.

**Polygon.io (gratis, sin tarjeta):**
1. Registrate en [polygon.io](https://polygon.io)
2. En el dashboard → **API Keys** → copiá tu key
3. Pegala en la app y guardá

**Anthropic Claude:**
1. Entrá a [console.anthropic.com](https://console.anthropic.com)
2. **Billing** → cargá mínimo $5 USD
3. **API Keys** → **Create Key** → copiá (solo se muestra una vez)
4. Pegala en la app y guardá

> Las keys se guardan en `localStorage` de tu navegador. Nunca van a ningún servidor.

---

## Deploy en Vercel (recomendado)

```bash
npm install -g vercel
vercel
```

O conectá el repo a [vercel.com](https://vercel.com) para deploy automático en cada push.

No necesitás variables de entorno — las API keys las maneja cada usuario desde la UI.

---

## Estructura del proyecto

```
stockpulse/
├── app/
│   ├── page.js              # Analizador principal
│   ├── resumen/page.js      # Resumen de mercado
│   ├── guia/page.js         # Guía de indicadores
│   ├── config/page.js       # Configuración de API keys
│   └── api/
│       ├── market-data/     # Llama a Polygon.io
│       └── narrative/       # Llama a Claude API
├── components/
│   ├── Navbar.js
│   ├── KeysBanner.js
│   ├── SearchBox.js
│   ├── ResultCard.js
│   └── ManualForm.js
└── lib/
    ├── useKeys.js           # Manejo de API keys en localStorage
    └── analyze.js           # Motor estadístico de 14 indicadores
```

---

## Limitaciones del plan gratuito de Polygon

- **5 llamadas/minuto** — suficiente para uso personal
- **Datos con 15 min de delay** — no en tiempo real
- **Solo acciones de EEUU** (NYSE, NASDAQ)
- Fundamentales (P/E, EPS, márgenes) **no incluidos** → ingresar manualmente en el formulario

Para datos en tiempo real o fundamentales: plan Starter de Polygon ($29/mes).

---

## Próximos pasos (roadmap)

- [ ] Auth con Supabase (usuarios, watchlist)
- [ ] Watchlist con alertas por email
- [ ] Integración Stripe para plan Pro
- [ ] SEO: páginas indexables por ticker (`/analisis/AAPL`)
- [ ] Soporte para acciones latinoamericanas (BYMA, BMV)
- [ ] PWA instalable

---

*StockPulse · Plan Maestro v2.0 · Abril 2026*
