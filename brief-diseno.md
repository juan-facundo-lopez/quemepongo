# Brief de diseño — "¿Qué me pongo?"

App/web que recomienda qué ropa usar según el clima. La ropa es el protagonista de la pantalla; los datos climáticos son secundarios.

## Jerarquía de información (de arriba a abajo)

1. **Hero — recomendación de ropa** (lo más grande y lo primero que se lee)
   - Ícono de la prenda recomendada, estilo dot-matrix (ver abajo)
   - Frase corta: ej. "Llevá campera liviana"
   - Subtexto breve de contexto: ej. "Fresco a la mañana, mejora después"
   - Mini-íconos de alertas rápidas (lluvia, viento)
2. **Clima ahora — secundario**
   - **La sensación térmica es el número protagonista de este bloque** (más grande, más jerarquía)
   - La temperatura real pasa a ser un dato más chico, junto a máx/mín y humedad
3. **Datos extra** (UV, viento, probabilidad de lluvia) en tarjetas chicas
4. **Pronóstico por hora** (opcional / colapsable)

## Estilo visual

- **Tema:** oscuro (fondo casi negro, tarjetas gris oscuro con borde sutil)
- **Tipografía:** monoespaciada (buscando un aire técnico/canchero)
- **Íconos:** técnica dot-matrix (puntos circulares) — pero **no dibujados a mano**: se generan muestreando la silueta vectorial real de cada prenda o elemento climático (sol, nube, lluvia, campera, remera, bufanda, etc.). Esto asegura que el ícono sea reconocible y no un patrón abstracto.
- **Sin liquid glass / glassmorphism** — se probó y no aporta sobre un fondo negro liso sin contenido de color detrás. Queda como idea a futuro solo si en algún momento el fondo de la app tiene color o textura dinámica.
- Tarjetas con esquinas bien redondeadas (estilo "píldora"), sin sombras duras

## Pendiente para esta etapa de diseño (Claude Design)

- Set completo de íconos dot-matrix: prendas (campera, remera, buzo, short, bufanda, paraguas) y clima (sol, nube, lluvia, viento, nieve)
- Definir paleta final de grises/acentos sobre el fondo oscuro
- Definir tipografía definitiva (mono real a elegir, tamaños, pesos)
- Estados de la app: sol fuerte, lluvia, frío extremo, viento fuerte
- Micro-interacciones o transiciones si suman

## Lo que NO cambiar (ya validado con el usuario)

- Ropa primero, clima segundo — esto es el corazón de la propuesta
- Sensación térmica > temperatura real en jerarquía visual
- Íconos derivados de siluetas reales, no patrones inventados
