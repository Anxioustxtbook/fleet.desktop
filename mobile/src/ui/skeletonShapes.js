/* The shapes of the loading placeholders (no React, so they are tested). Widths are percentages of the row; heights are in points. */
export const SHAPES = {
  list:     { header: [{ w: 60, h: 40 }], rows: 7, row: [[{ w: 55, h: 16 }, { w: 22, h: 16 }], [{ w: 38, h: 12 }, { w: 16, h: 12 }]] },
  cards:    { header: [], rows: 4, row: [[{ w: 45, h: 18 }], [{ w: 90, h: 12 }], [{ w: 70, h: 12 }]] },
  calendar: { header: [{ w: 100, h: 30 }], grid: { cols: 7, rows: 5, h: 58 } },
  report:   { header: [{ w: 100, h: 34 }], tiles: 6, rows: 2, row: [[{ w: 40, h: 16 }, { w: 25, h: 16 }], [{ w: 85, h: 12 }]] }
};
export const SKELETON_DELAY_MS = 120;           // no flash when the data arrives at once
export const skeletonKinds = () => Object.keys(SHAPES);
