'use strict';

(() => {
  const MINIMUM_GARMENTS = 5;
  const IDEAL_GARMENTS = 8;
  const NEUTRAL_COLORS = new Set(['negro', 'blanco', 'gris', 'beige', 'marron', 'crema']);
  const COLOR_COMPANIONS = {
    azul: ['blanco', 'gris', 'beige', 'marron', 'rojo', 'rosa', 'naranja'],
    rojo: ['negro', 'blanco', 'gris', 'beige', 'azul', 'rosa'],
    verde: ['negro', 'blanco', 'gris', 'beige', 'marron', 'amarillo', 'azul'],
    amarillo: ['negro', 'blanco', 'gris', 'beige', 'azul', 'verde', 'violeta'],
    rosa: ['negro', 'blanco', 'gris', 'beige', 'azul', 'rojo', 'violeta'],
    violeta: ['negro', 'blanco', 'gris', 'beige', 'rosa', 'amarillo'],
    naranja: ['negro', 'blanco', 'gris', 'beige', 'azul', 'marron'],
    multicolor: ['negro', 'blanco', 'gris', 'beige', 'marron']
  };
  const STYLE_COMPATIBILITY = {
    casual: { casual: 6, formal: 1, urbano: 3, deportivo: 1 },
    formal: { casual: 1, formal: 7, urbano: -3, deportivo: -10 },
    urbano: { casual: 3, formal: -3, urbano: 7, deportivo: 2 },
    deportivo: { casual: 1, formal: -10, urbano: 2, deportivo: 7 }
  };
  const STRONG_PATTERNS = new Set(['rayado', 'cuadros', 'estampado', 'animal_print', 'lunares']);
  const SLOT_CATEGORIES = {
    top: ['Remera', 'Camisa', 'Vestido'],
    mid: ['Buzo', 'Sweater'],
    outer: ['Campera', 'Abrigo'],
    bottom: ['Pantalón', 'Short', 'Pollera'],
    feet: ['Calzado']
  };
  const WARMTH_SCORE = { 'Muy liviano': 0, Liviano: 1, Medio: 2, Abrigado: 3, 'Muy abrigado': 4, Alto: 3 };

  const CANDIDATES = [
    {
      id: 'light-basic-tee',
      label: 'Remera lisa clara',
      category: 'Remera',
      subtype: 'Remera básica',
      colorOptions: ['Crema', 'Blanco', 'Gris'],
      warmth: 'Liviano',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['verano', 'primavera', 'otoño'],
      occasions: ['casual', 'diario'],
      icon: 'remera'
    },
    {
      id: 'versatile-shirt',
      label: 'Camisa versátil',
      category: 'Camisa',
      subtype: 'Camisa lisa',
      colorOptions: ['Blanco', 'Celeste', 'Beige'],
      warmth: 'Medio',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['primavera', 'otoño', 'invierno'],
      occasions: ['casual', 'trabajo', 'salida'],
      icon: 'remera'
    },
    {
      id: 'neutral-sweater',
      label: 'Sweater neutro',
      category: 'Sweater',
      subtype: 'Sweater liso',
      colorOptions: ['Gris', 'Beige', 'Negro'],
      warmth: 'Abrigado',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['otoño', 'invierno'],
      occasions: ['casual', 'trabajo'],
      icon: 'buzo'
    },
    {
      id: 'urban-hoodie',
      label: 'Buzo urbano',
      category: 'Buzo',
      subtype: 'Buzo liso',
      colorOptions: ['Gris', 'Negro', 'Azul'],
      warmth: 'Medio',
      style: 'Urbano',
      pattern: 'liso',
      waterproof: false,
      seasons: ['otoño', 'invierno', 'primavera'],
      occasions: ['casual', 'urbano', 'salida'],
      icon: 'buzo'
    },
    {
      id: 'urban-rain-jacket',
      label: 'Campera impermeable urbana',
      category: 'Campera',
      subtype: 'Campera impermeable',
      colorOptions: ['Negro', 'Azul', 'Beige'],
      warmth: 'Abrigado',
      style: 'Urbano',
      pattern: 'liso',
      waterproof: true,
      seasons: ['otoño', 'invierno', 'primavera'],
      occasions: ['casual', 'urbano', 'lluvia'],
      icon: 'campera'
    },
    {
      id: 'warm-versatile-coat',
      label: 'Abrigo cálido versátil',
      category: 'Abrigo',
      subtype: 'Abrigo largo',
      colorOptions: ['Negro', 'Gris', 'Beige'],
      warmth: 'Muy abrigado',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['invierno'],
      occasions: ['casual', 'trabajo', 'salida'],
      icon: 'campera'
    },
    {
      id: 'dark-versatile-pants',
      label: 'Pantalón oscuro versátil',
      category: 'Pantalón',
      subtype: 'Pantalón recto',
      colorOptions: ['Negro', 'Azul', 'Gris'],
      warmth: 'Medio',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['otoño', 'invierno', 'primavera'],
      occasions: ['casual', 'trabajo', 'salida'],
      icon: 'pantalon'
    },
    {
      id: 'light-casual-pants',
      label: 'Pantalón claro casual',
      category: 'Pantalón',
      subtype: 'Pantalón recto',
      colorOptions: ['Beige', 'Crema', 'Gris'],
      warmth: 'Medio',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['primavera', 'verano', 'otoño'],
      occasions: ['casual', 'diario', 'salida'],
      icon: 'pantalon'
    },
    {
      id: 'neutral-casual-shorts',
      label: 'Short neutro',
      category: 'Short',
      subtype: 'Short casual',
      colorOptions: ['Beige', 'Negro', 'Gris'],
      warmth: 'Muy liviano',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['verano', 'primavera'],
      occasions: ['casual', 'diario'],
      icon: 'shorts'
    },
    {
      id: 'light-casual-sneakers',
      label: 'Zapatillas claras casuales',
      category: 'Calzado',
      subtype: 'Zapatillas',
      colorOptions: ['Blanco', 'Gris', 'Beige'],
      warmth: 'Medio',
      style: 'Casual',
      pattern: 'liso',
      waterproof: false,
      seasons: ['verano', 'otoño', 'invierno', 'primavera'],
      occasions: ['casual', 'diario', 'salida'],
      icon: 'calzado'
    },
    {
      id: 'waterproof-urban-shoes',
      label: 'Calzado impermeable urbano',
      category: 'Calzado',
      subtype: 'Bota o zapatilla impermeable',
      colorOptions: ['Negro', 'Marrón', 'Gris'],
      warmth: 'Abrigado',
      style: 'Urbano',
      pattern: 'liso',
      waterproof: true,
      seasons: ['otoño', 'invierno'],
      occasions: ['casual', 'urbano', 'lluvia'],
      icon: 'calzado'
    },
    {
      id: 'training-breathable-tee',
      label: 'Remera deportiva liviana',
      category: 'Remera',
      subtype: 'Remera técnica',
      colorOptions: ['Negro', 'Gris', 'Azul'],
      warmth: 'Muy liviano',
      style: 'Deportivo',
      pattern: 'liso',
      waterproof: false,
      seasons: ['verano', 'primavera', 'otoño'],
      occasions: ['deportivo', 'gimnasio', 'entrenamiento'],
      icon: 'remera'
    },
    {
      id: 'training-pants',
      label: 'Pantalón deportivo',
      category: 'Pantalón',
      subtype: 'Pantalón de entrenamiento',
      colorOptions: ['Negro', 'Gris', 'Azul'],
      warmth: 'Liviano',
      style: 'Deportivo',
      pattern: 'liso',
      waterproof: false,
      seasons: ['verano', 'otoño', 'invierno', 'primavera'],
      occasions: ['deportivo', 'gimnasio', 'entrenamiento'],
      icon: 'pantalon'
    },
    {
      id: 'training-shoes',
      label: 'Zapatillas de entrenamiento',
      category: 'Calzado',
      subtype: 'Zapatillas deportivas',
      colorOptions: ['Negro', 'Blanco', 'Gris'],
      warmth: 'Medio',
      style: 'Deportivo',
      pattern: 'liso',
      waterproof: false,
      seasons: ['verano', 'otoño', 'invierno', 'primavera'],
      occasions: ['deportivo', 'gimnasio', 'entrenamiento'],
      icon: 'calzado'
    }
  ];

  function normalize(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function getSlot(item) {
    return Object.keys(SLOT_CATEGORIES).find((slot) => SLOT_CATEGORIES[slot].includes(item?.category)) || '';
  }

  function getColors(item) {
    const colors = [item?.color].concat(Array.isArray(item?.secondaryColors) ? item.secondaryColors : []);
    return [...new Set(colors.map(normalize).filter((color) => color && color !== 'sin definir'))];
  }

  function colorHarmony(first, second) {
    const firstKey = normalize(first);
    const secondKey = normalize(second);
    if (!firstKey || !secondKey) return 0;
    if (firstKey === secondKey) return 3;
    if (NEUTRAL_COLORS.has(firstKey) || NEUTRAL_COLORS.has(secondKey)) return 4;
    if (COLOR_COMPANIONS[firstKey]?.includes(secondKey) || COLOR_COMPANIONS[secondKey]?.includes(firstKey)) return 3;
    if (firstKey === 'multicolor' || secondKey === 'multicolor') return -4;
    return -2;
  }

  function colorScore(first, second) {
    const firstColors = getColors(first);
    const secondColors = getColors(second);
    if (!firstColors.length || !secondColors.length) return 0;
    let best = -4;
    firstColors.forEach((firstColor) => {
      secondColors.forEach((secondColor) => {
        best = Math.max(best, colorHarmony(firstColor, secondColor));
      });
    });
    return best;
  }

  function styleScore(first, second) {
    const firstStyle = normalize(first?.style);
    const secondStyle = normalize(second?.style);
    if (!firstStyle || !secondStyle) return 0;
    return STYLE_COMPATIBILITY[firstStyle]?.[secondStyle] ?? STYLE_COMPATIBILITY[secondStyle]?.[firstStyle] ?? 0;
  }

  function patternScore(first, second) {
    const firstPattern = normalize(first?.pattern);
    const secondPattern = normalize(second?.pattern);
    const firstStrong = STRONG_PATTERNS.has(firstPattern);
    const secondStrong = STRONG_PATTERNS.has(secondPattern);
    if (firstStrong && secondStrong) return firstPattern === secondPattern ? -5 : -8;
    if (firstStrong || secondStrong) return 2;
    return 1;
  }

  function occasionScore(first, second) {
    const firstOccasions = new Set((first?.occasions || []).map(normalize));
    const secondOccasions = (second?.occasions || []).map(normalize);
    if (!firstOccasions.size || !secondOccasions.length) return 0;
    return secondOccasions.some((occasion) => firstOccasions.has(occasion)) ? 2 : 0;
  }

  function pairScore(first, second) {
    return colorScore(first, second) + styleScore(first, second) + patternScore(first, second) + occasionScore(first, second);
  }

  function profileWardrobe(wardrobe) {
    const slotCounts = { top: 0, mid: 0, outer: 0, bottom: 0, feet: 0 };
    const styleCounts = {};
    const colorCounts = {};
    let waterproofCount = 0;
    let warmCount = 0;

    wardrobe.forEach((item) => {
      const slot = getSlot(item);
      if (slot) slotCounts[slot] += 1;
      const style = normalize(item.style);
      if (style) styleCounts[style] = (styleCounts[style] || 0) + 1;
      getColors(item).forEach((color) => { colorCounts[color] = (colorCounts[color] || 0) + 1; });
      if (item.waterproof === true) waterproofCount += 1;
      if ((WARMTH_SCORE[item.warmth] ?? 1) >= 3) warmCount += 1;
    });

    const dominantStyle = Object.keys(styleCounts).sort((a, b) => styleCounts[b] - styleCounts[a])[0] || 'casual';
    const dominantColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]).slice(0, 3);
    return { slotCounts, styleCounts, colorCounts, dominantStyle, dominantColors, waterproofCount, warmCount };
  }

  function chooseCandidateColor(candidate, wardrobe) {
    const rankedColors = candidate.colorOptions.map((color) => {
      const coloredCandidate = { ...candidate, color };
      const harmony = wardrobe.reduce((sum, item) => sum + Math.max(-2, colorScore(coloredCandidate, item)), 0);
      const duplicateCount = wardrobe.filter((item) => (
        item.category === candidate.category && normalize(item.color) === normalize(color)
      )).length;
      return { color, score: harmony - duplicateCount * 5 };
    }).sort((a, b) => b.score - a.score);

    return {
      color: rankedColors[0]?.color || candidate.colorOptions[0],
      colorOptions: rankedColors.map((entry) => entry.color)
    };
  }

  function isCoreLookCompatible(items) {
    for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
        if (pairScore(items[firstIndex], items[secondIndex]) < 0) return false;
      }
    }
    return true;
  }

  function countNewLooks(candidate, wardrobe) {
    const groups = {
      top: wardrobe.filter((item) => getSlot(item) === 'top'),
      bottom: wardrobe.filter((item) => getSlot(item) === 'bottom'),
      feet: wardrobe.filter((item) => getSlot(item) === 'feet')
    };
    const candidateSlot = getSlot(candidate);
    let count = 0;

    if (candidateSlot === 'top') {
      groups.bottom.forEach((bottom) => groups.feet.forEach((feet) => {
        if (isCoreLookCompatible([candidate, bottom, feet])) count += 1;
      }));
    } else if (candidateSlot === 'bottom') {
      groups.top.forEach((top) => groups.feet.forEach((feet) => {
        if (isCoreLookCompatible([top, candidate, feet])) count += 1;
      }));
    } else if (candidateSlot === 'feet') {
      groups.top.forEach((top) => groups.bottom.forEach((bottom) => {
        if (isCoreLookCompatible([top, bottom, candidate])) count += 1;
      }));
    } else {
      groups.top.forEach((top) => groups.bottom.forEach((bottom) => groups.feet.forEach((feet) => {
        if (isCoreLookCompatible([top, bottom, feet, candidate])) count += 1;
      })));
    }

    return Math.min(24, count);
  }

  function matchesFilter(candidate, filter, feedbackEntry) {
    if (filter === 'saved') return feedbackEntry?.status === 'saved';
    if (filter === 'training') return normalize(candidate.style) === 'deportivo';
    if (filter === 'rain') return candidate.waterproof === true;
    if (filter === 'cold') return (WARMTH_SCORE[candidate.warmth] ?? 1) >= 3;
    if (filter === 'casual') return normalize(candidate.style) !== 'deportivo';
    return true;
  }

  function buildReason(candidate, profile, duplicateCount, compatibleCount) {
    const slot = getSlot(candidate);
    if (candidate.waterproof && profile.waterproofCount === 0) {
      return 'Tu armario no tiene una opción impermeable. Esta prenda completaría looks para días de lluvia.';
    }
    if ((WARMTH_SCORE[candidate.warmth] ?? 1) >= 3 && profile.warmCount === 0) {
      return 'Tenés opciones para combinar, pero ninguna capa de abrigo suficiente para los días más fríos.';
    }
    if (slot && profile.slotCounts[slot] === 0) {
      const slotNames = { top: 'parte superior', mid: 'capa media', outer: 'capa exterior', bottom: 'parte inferior', feet: 'calzado' };
      return `No tenés prendas cargadas para ${slotNames[slot]}. Esta incorporación completaría varios looks actuales.`;
    }
    if (duplicateCount === 0 && compatibleCount >= 4) {
      return `Aporta una opción diferente sin alejarse de tu estilo y combina bien con ${compatibleCount} prendas que ya tenés.`;
    }
    return `Amplía tus alternativas para vestirte y combina bien con ${compatibleCount} prendas de tu armario.`;
  }

  function scoreCandidate(candidate, wardrobe, profile, feedbackEntry, filter) {
    const selectedColor = chooseCandidateColor(candidate, wardrobe);
    const item = { ...candidate, color: selectedColor.color, colorOptions: selectedColor.colorOptions };
    const slot = getSlot(item);
    const duplicateCount = wardrobe.filter((garment) => (
      garment.category === item.category
      && normalize(garment.style) === normalize(item.style)
      && getColors(garment).includes(normalize(item.color))
    )).length;
    const sameCategoryCount = wardrobe.filter((garment) => garment.category === item.category).length;
    const compatible = wardrobe
      .filter((garment) => getSlot(garment) !== slot)
      .map((garment) => ({ garment, score: pairScore(item, garment) }))
      .filter((entry) => entry.score >= 2)
      .sort((a, b) => b.score - a.score);
    const compatibleCount = compatible.length;
    const looksNew = countNewLooks(item, wardrobe);

    let score = Math.min(looksNew, 12) * 3 + Math.min(compatibleCount, 10) * 2.2;
    if (slot && profile.slotCounts[slot] === 0) score += 24;
    else if (slot && profile.slotCounts[slot] === 1) score += 12;
    else score += Math.max(0, 7 - sameCategoryCount * 2);
    if (item.waterproof && profile.waterproofCount === 0) score += 22;
    if ((WARMTH_SCORE[item.warmth] ?? 1) >= 3 && profile.warmCount === 0) score += 15;
    if (normalize(item.style) === profile.dominantStyle) score += 7;
    if (filter === 'training' && normalize(item.style) === 'deportivo') score += 12;
    if (filter === 'rain' && item.waterproof) score += 12;
    if (filter === 'cold' && (WARMTH_SCORE[item.warmth] ?? 1) >= 3) score += 10;
    if (duplicateCount === 0) score += 6;
    score -= duplicateCount * 18;
    if (feedbackEntry?.status === 'saved') score += 5;

    const colorsCopy = selectedColor.colorOptions.slice(0, 3).join(', ');
    const searchText = `${item.label} ${selectedColor.colorOptions.slice(0, 2).join(' o ')}, ${item.style.toLowerCase()}, abrigo ${item.warmth.toLowerCase()}`;
    return {
      ...item,
      score,
      looksNew,
      compatibleCount,
      compatibleGarmentIds: compatible.slice(0, 9).map((entry) => entry.garment.id),
      reason: buildReason(item, profile, duplicateCount, compatibleCount),
      colorsCopy,
      searchText,
      saved: feedbackEntry?.status === 'saved',
      specs: [
        ['Tipo', item.subtype || item.category],
        ['Colores', colorsCopy],
        ['Abrigo', item.warmth],
        ['Estilo', item.style],
        ['Textura', item.pattern === 'liso' ? 'Lisa' : item.pattern],
        ['Uso ideal', item.waterproof ? 'Lluvia y uso diario' : (item.occasions || []).slice(0, 2).join(' y ')]
      ]
    };
  }

  function analyze(wardrobe, options = {}) {
    const safeWardrobe = Array.isArray(wardrobe) ? wardrobe.filter(Boolean) : [];
    const filter = options.filter || 'all';
    const feedback = options.feedback && typeof options.feedback === 'object' ? options.feedback : {};
    const profile = profileWardrobe(safeWardrobe);
    const remaining = Math.max(0, IDEAL_GARMENTS - safeWardrobe.length);

    if (safeWardrobe.length < MINIMUM_GARMENTS) {
      return {
        ready: false,
        minimum: MINIMUM_GARMENTS,
        ideal: IDEAL_GARMENTS,
        remaining,
        progress: Math.min(100, Math.round((safeWardrobe.length / MINIMUM_GARMENTS) * 100)),
        profile,
        recommendations: []
      };
    }

    const recommendations = CANDIDATES
      .filter((candidate) => matchesFilter(candidate, filter, feedback[candidate.id]))
      .filter((candidate) => !['dismissed', 'owned'].includes(feedback[candidate.id]?.status))
      .map((candidate) => scoreCandidate(candidate, safeWardrobe, profile, feedback[candidate.id], filter))
      .filter((candidate) => candidate.compatibleCount > 0 || profile.slotCounts[getSlot(candidate)] === 0)
      .sort((first, second) => second.score - first.score)
      .slice(0, filter === 'saved' ? 20 : 6)
      .map((candidate, index) => ({
        ...candidate,
        impactLabel: index === 0 ? 'Mayor impacto' : index === 1 ? 'Muy útil' : 'Buena incorporación',
        confidence: safeWardrobe.length >= 10 ? 'Alta' : 'Media'
      }));

    return {
      ready: true,
      minimum: MINIMUM_GARMENTS,
      ideal: IDEAL_GARMENTS,
      remaining: 0,
      progress: 100,
      profile,
      recommendations
    };
  }

  globalThis.QMPRecommendations = Object.freeze({
    analyze,
    getSlot,
    minimumGarments: MINIMUM_GARMENTS,
    filters: ['all', 'saved', 'casual', 'training', 'rain', 'cold']
  });
})();
