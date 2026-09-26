// Area coordinates for distance estimation (Pune/Haveli service grid)
// Shared by matching engine and seed data.

export const AREA_COORDS: Record<string, { x: number; y: number }> = {
  Kothrud: { x: 4, y: 8 }, 'Karve Nagar': { x: 5, y: 9.5 }, Warje: { x: 5.5, y: 11 },
  'Sinhagad Road': { x: 6.5, y: 12 }, Shivajinagar: { x: 7, y: 5 }, Aundh: { x: 7, y: 2.5 },
  Baner: { x: 7.5, y: 1.5 }, Bavdhan: { x: 6.5, y: 2.5 }, Erandwane: { x: 6, y: 7 },
  Deccan: { x: 7, y: 6.5 }, Swargate: { x: 8, y: 8.5 }, Parvati: { x: 8, y: 9.5 },
  Sahakarnagar: { x: 8.5, y: 10.5 }, Katraj: { x: 9, y: 12.5 }, Kondhwa: { x: 10, y: 10.5 },
  Wanowrie: { x: 9.8, y: 9.8 }, Hadapsar: { x: 12, y: 9.5 }, 'Viman Nagar': { x: 13, y: 6 },
  'Chandan Nagar': { x: 13.5, y: 7.5 }, Yerawada: { x: 12, y: 5 }, Dhanori: { x: 13, y: 4 },
  Vishrantwadi: { x: 12.5, y: 4 }, 'Pimple Saudagar': { x: 10, y: 2 }, Pimpri: { x: 9.5, y: 1 },
  Chinchwad: { x: 10, y: 0.5 }, Nigdi: { x: 9, y: 0.8 }, Akurdi: { x: 9, y: 1.5 },
  Wakad: { x: 9.5, y: 2 }, Hinjewadi: { x: 9, y: 3 }, Balewadi: { x: 8.2, y: 2.2 },
  Pashan: { x: 8, y: 3 }, Sus: { x: 8.5, y: 4 }, Bibwewadi: { x: 9.5, y: 9.5 },
  'Balaji Nagar': { x: 9.5, y: 10.8 }, Dhankawadi: { x: 9, y: 11.5 }, Gultekdi: { x: 9.2, y: 9 },
  'Market Yard': { x: 9.5, y: 10 }, Kharadi: { x: 14, y: 8.5 }, Wagholi: { x: 15.5, y: 7 },
}

export function areaDistance(a: string, b: string): number {
  const pa = AREA_COORDS[a]
  const pb = AREA_COORDS[b]
  if (pa && pb) return Math.round(Math.hypot(pa.x - pb.x, pa.y - pb.y) * 1.6 * 10) / 10
  if (!pa && !pb) {
    // deterministic pseudo-distance for out-of-grid locality pairs (10–40 km)
    let h = 0
    for (const ch of a + b) h = (h * 31 + ch.charCodeAt(0)) % 9973
    return 10 + (h % 31)
  }
  return 55 // one known Pune area, one outside the city grid — treat as out-of-area
}
