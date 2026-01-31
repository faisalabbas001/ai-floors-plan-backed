/**
 * DXF File Generator
 * Generates AutoCAD-compatible DXF files from floor plan data
 */

// DXF Layer definitions following AIA standards
const DXF_LAYERS = {
  WALLS: 'A-WALL',
  WALLS_INTERIOR: 'A-WALL-INTR',
  DOORS: 'A-DOOR',
  WINDOWS: 'A-GLAZ',
  ROOMS: 'A-AREA',
  LABELS: 'A-ANNO-TEXT',
  DIMENSIONS: 'A-ANNO-DIMS',
  FURNITURE: 'A-FURN',
  GRID: 'A-GRID',
  TITLE: 'A-ANNO-TITL',
};

// Color codes for DXF (AutoCAD color index)
const DXF_COLORS = {
  WHITE: 7,
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  CYAN: 4,
  BLUE: 5,
  MAGENTA: 6,
  GRAY: 8,
};

/**
 * Generate complete DXF file content
 */
function generateDXF(planData, floorIndex = 0, options = {}) {
  const { scale = 1 } = options;
  const floor = planData.floors[floorIndex];

  if (!floor) {
    throw new Error(`Floor index ${floorIndex} not found`);
  }

  let dxf = '';

  // 1. Header Section
  dxf += generateHeader(planData, scale);

  // 2. Tables Section (Layers, Line Types, Styles)
  dxf += generateTables();

  // 3. Blocks Section (for door/window symbols)
  dxf += generateBlocks();

  // 4. Entities Section (actual geometry)
  dxf += generateEntities(planData, floor, scale);

  // 5. End of File
  dxf += '0\nEOF\n';

  return dxf;
}

/**
 * Generate DXF Header Section
 */
function generateHeader(planData, scale) {
  const buildingWidth = (planData.buildingDimensions?.width || 50) * scale;
  const buildingDepth = (planData.buildingDimensions?.depth || 40) * scale;

  return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1021
9
$DWGCODEPAGE
3
ANSI_1252
9
$INSBASE
10
0.0
20
0.0
30
0.0
9
$EXTMIN
10
0.0
20
0.0
30
0.0
9
$EXTMAX
10
${buildingWidth.toFixed(4)}
20
${buildingDepth.toFixed(4)}
30
0.0
9
$LIMMIN
10
0.0
20
0.0
9
$LIMMAX
10
${buildingWidth.toFixed(4)}
20
${buildingDepth.toFixed(4)}
9
$INSUNITS
70
1
9
$LUNITS
70
2
9
$LUPREC
70
4
9
$MEASUREMENT
70
0
0
ENDSEC
`;
}

/**
 * Generate DXF Tables Section with layer definitions
 */
function generateTables() {
  let tables = `0
SECTION
2
TABLES
0
TABLE
2
LTYPE
70
1
0
LTYPE
2
CONTINUOUS
70
0
3
Solid line
72
65
73
0
40
0.0
0
ENDTAB
0
TABLE
2
LAYER
70
${Object.keys(DXF_LAYERS).length}
`;

  // Add layer definitions
  const layerConfigs = [
    { name: DXF_LAYERS.WALLS, color: DXF_COLORS.WHITE, lineWeight: 50 },
    { name: DXF_LAYERS.WALLS_INTERIOR, color: DXF_COLORS.WHITE, lineWeight: 25 },
    { name: DXF_LAYERS.DOORS, color: DXF_COLORS.GREEN, lineWeight: 18 },
    { name: DXF_LAYERS.WINDOWS, color: DXF_COLORS.CYAN, lineWeight: 18 },
    { name: DXF_LAYERS.ROOMS, color: DXF_COLORS.GRAY, lineWeight: 13 },
    { name: DXF_LAYERS.LABELS, color: DXF_COLORS.WHITE, lineWeight: 13 },
    { name: DXF_LAYERS.DIMENSIONS, color: DXF_COLORS.RED, lineWeight: 13 },
    { name: DXF_LAYERS.FURNITURE, color: DXF_COLORS.MAGENTA, lineWeight: 13 },
    { name: DXF_LAYERS.GRID, color: DXF_COLORS.GRAY, lineWeight: 9 },
    { name: DXF_LAYERS.TITLE, color: DXF_COLORS.WHITE, lineWeight: 35 },
  ];

  layerConfigs.forEach(layer => {
    tables += `0
LAYER
2
${layer.name}
70
0
62
${layer.color}
6
CONTINUOUS
370
${layer.lineWeight}
`;
  });

  tables += `0
ENDTAB
0
TABLE
2
STYLE
70
1
0
STYLE
2
STANDARD
70
0
40
0.0
41
1.0
50
0.0
71
0
42
0.2
3
txt
4

0
ENDTAB
0
ENDSEC
`;

  return tables;
}

/**
 * Generate DXF Blocks Section
 */
function generateBlocks() {
  return `0
SECTION
2
BLOCKS
0
ENDSEC
`;
}

/**
 * Generate DXF Entities Section
 */
function generateEntities(planData, floor, scale) {
  let entities = `0
SECTION
2
ENTITIES
`;

  // Building outline
  if (planData.buildingDimensions) {
    const bw = planData.buildingDimensions.width * scale;
    const bd = planData.buildingDimensions.depth * scale;
    entities += createPolyline([
      [0, 0], [bw, 0], [bw, bd], [0, bd], [0, 0]
    ], DXF_LAYERS.WALLS, true);
  }

  // Process each room
  floor.rooms.forEach(room => {
    const x = (room.position?.x || 0) * scale;
    const y = (room.position?.y || 0) * scale;
    const w = (room.dimensions?.width || Math.sqrt(room.areaSqft)) * scale;
    const h = (room.dimensions?.length || Math.sqrt(room.areaSqft)) * scale;

    // Room outline with wall thickness
    entities += createPolyline([
      [x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]
    ], DXF_LAYERS.WALLS_INTERIOR, true);

    // Room name label (centered)
    entities += createMText(
      room.name.toUpperCase(),
      x + w / 2,
      y + h / 2 + 1,
      DXF_LAYERS.LABELS,
      0.8 * scale,
      'center'
    );

    // Room dimensions label
    const dimW = room.dimensions?.width || Math.round(w / scale);
    const dimH = room.dimensions?.length || Math.round(h / scale);
    entities += createMText(
      `${dimW}' x ${dimH}'`,
      x + w / 2,
      y + h / 2 - 0.5,
      DXF_LAYERS.LABELS,
      0.5 * scale,
      'center'
    );

    // Room area label
    entities += createMText(
      `${room.areaSqft} SF`,
      x + w / 2,
      y + h / 2 - 1.5,
      DXF_LAYERS.LABELS,
      0.4 * scale,
      'center'
    );

    // Draw doors
    if (room.doors && room.doors.length > 0) {
      room.doors.forEach(door => {
        entities += createDoor(x, y, w, h, door, scale);
      });
    }

    // Draw windows
    if (room.windows && room.windows.length > 0) {
      room.windows.forEach(window => {
        entities += createWindow(x, y, w, h, window, scale);
      });
    }
  });

  // Title block
  const bw = (planData.buildingDimensions?.width || 50) * scale;
  entities += createMText(
    `${(planData.buildingType || 'FLOOR PLAN').toUpperCase()}`,
    bw - 2,
    -3,
    DXF_LAYERS.TITLE,
    1.2 * scale,
    'right'
  );

  entities += createMText(
    `${floor.level} - ${floor.totalArea || 0} SF`,
    bw - 2,
    -5,
    DXF_LAYERS.LABELS,
    0.6 * scale,
    'right'
  );

  entities += `0
ENDSEC
`;

  return entities;
}

/**
 * Create closed polyline (LWPOLYLINE)
 */
function createPolyline(points, layer, closed = false) {
  let content = `0
LWPOLYLINE
8
${layer}
90
${points.length}
70
${closed ? 1 : 0}
`;

  points.forEach(([x, y]) => {
    content += `10
${x.toFixed(4)}
20
${y.toFixed(4)}
`;
  });

  return content;
}

/**
 * Create line entity
 */
function createLine(x1, y1, x2, y2, layer) {
  return `0
LINE
8
${layer}
10
${x1.toFixed(4)}
20
${y1.toFixed(4)}
11
${x2.toFixed(4)}
21
${y2.toFixed(4)}
`;
}

/**
 * Create arc entity
 */
function createArc(cx, cy, radius, startAngle, endAngle, layer) {
  return `0
ARC
8
${layer}
10
${cx.toFixed(4)}
20
${cy.toFixed(4)}
40
${radius.toFixed(4)}
50
${startAngle.toFixed(4)}
51
${endAngle.toFixed(4)}
`;
}

/**
 * Create MTEXT entity (multiline text with alignment)
 */
function createMText(text, x, y, layer, height, align = 'left') {
  // Attachment point: 1=TopLeft, 2=TopCenter, 3=TopRight, 4=MiddleLeft, 5=MiddleCenter, 6=MiddleRight
  let attachmentPoint = 5; // Default middle center
  if (align === 'left') attachmentPoint = 4;
  if (align === 'right') attachmentPoint = 6;

  return `0
MTEXT
8
${layer}
10
${x.toFixed(4)}
20
${y.toFixed(4)}
40
${height.toFixed(4)}
71
${attachmentPoint}
1
${text}
`;
}

/**
 * Create door representation with swing arc
 */
function createDoor(roomX, roomY, roomW, roomH, door, scale) {
  const doorWidth = (door.width || 3) * scale;
  const doorPos = (door.position || 0) * scale;
  let content = '';

  switch (door.wall) {
    case 'north': {
      const dx = roomX + doorPos;
      const dy = roomY;
      // Door opening (gap in wall)
      content += createLine(dx, dy, dx + doorWidth, dy, DXF_LAYERS.DOORS);
      // Door swing arc (90 degrees inward)
      content += createArc(dx, dy, doorWidth, 0, 90, DXF_LAYERS.DOORS);
      // Door panel
      content += createLine(dx, dy, dx, dy + doorWidth, DXF_LAYERS.DOORS);
      break;
    }
    case 'south': {
      const dx = roomX + doorPos;
      const dy = roomY + roomH;
      content += createLine(dx, dy, dx + doorWidth, dy, DXF_LAYERS.DOORS);
      content += createArc(dx, dy, doorWidth, 270, 360, DXF_LAYERS.DOORS);
      content += createLine(dx, dy, dx, dy - doorWidth, DXF_LAYERS.DOORS);
      break;
    }
    case 'west': {
      const dx = roomX;
      const dy = roomY + doorPos;
      content += createLine(dx, dy, dx, dy + doorWidth, DXF_LAYERS.DOORS);
      content += createArc(dx, dy, doorWidth, 0, 90, DXF_LAYERS.DOORS);
      content += createLine(dx, dy, dx + doorWidth, dy, DXF_LAYERS.DOORS);
      break;
    }
    case 'east': {
      const dx = roomX + roomW;
      const dy = roomY + doorPos;
      content += createLine(dx, dy, dx, dy + doorWidth, DXF_LAYERS.DOORS);
      content += createArc(dx, dy, doorWidth, 90, 180, DXF_LAYERS.DOORS);
      content += createLine(dx, dy, dx - doorWidth, dy, DXF_LAYERS.DOORS);
      break;
    }
  }

  return content;
}

/**
 * Create window representation (double line)
 */
function createWindow(roomX, roomY, roomW, roomH, window, scale) {
  const winWidth = (window.width || 4) * scale;
  const winPos = (window.position || 0) * scale;
  const offset = 0.15 * scale; // Gap between double lines
  let content = '';

  switch (window.wall) {
    case 'north': {
      const wx = roomX + winPos;
      const wy = roomY;
      // Double lines for window
      content += createLine(wx, wy - offset, wx + winWidth, wy - offset, DXF_LAYERS.WINDOWS);
      content += createLine(wx, wy + offset, wx + winWidth, wy + offset, DXF_LAYERS.WINDOWS);
      // End caps
      content += createLine(wx, wy - offset, wx, wy + offset, DXF_LAYERS.WINDOWS);
      content += createLine(wx + winWidth, wy - offset, wx + winWidth, wy + offset, DXF_LAYERS.WINDOWS);
      // Center line (glass)
      content += createLine(wx + winWidth * 0.5, wy - offset, wx + winWidth * 0.5, wy + offset, DXF_LAYERS.WINDOWS);
      break;
    }
    case 'south': {
      const wx = roomX + winPos;
      const wy = roomY + roomH;
      content += createLine(wx, wy - offset, wx + winWidth, wy - offset, DXF_LAYERS.WINDOWS);
      content += createLine(wx, wy + offset, wx + winWidth, wy + offset, DXF_LAYERS.WINDOWS);
      content += createLine(wx, wy - offset, wx, wy + offset, DXF_LAYERS.WINDOWS);
      content += createLine(wx + winWidth, wy - offset, wx + winWidth, wy + offset, DXF_LAYERS.WINDOWS);
      content += createLine(wx + winWidth * 0.5, wy - offset, wx + winWidth * 0.5, wy + offset, DXF_LAYERS.WINDOWS);
      break;
    }
    case 'west': {
      const wx = roomX;
      const wy = roomY + winPos;
      content += createLine(wx - offset, wy, wx - offset, wy + winWidth, DXF_LAYERS.WINDOWS);
      content += createLine(wx + offset, wy, wx + offset, wy + winWidth, DXF_LAYERS.WINDOWS);
      content += createLine(wx - offset, wy, wx + offset, wy, DXF_LAYERS.WINDOWS);
      content += createLine(wx - offset, wy + winWidth, wx + offset, wy + winWidth, DXF_LAYERS.WINDOWS);
      content += createLine(wx - offset, wy + winWidth * 0.5, wx + offset, wy + winWidth * 0.5, DXF_LAYERS.WINDOWS);
      break;
    }
    case 'east': {
      const wx = roomX + roomW;
      const wy = roomY + winPos;
      content += createLine(wx - offset, wy, wx - offset, wy + winWidth, DXF_LAYERS.WINDOWS);
      content += createLine(wx + offset, wy, wx + offset, wy + winWidth, DXF_LAYERS.WINDOWS);
      content += createLine(wx - offset, wy, wx + offset, wy, DXF_LAYERS.WINDOWS);
      content += createLine(wx - offset, wy + winWidth, wx + offset, wy + winWidth, DXF_LAYERS.WINDOWS);
      content += createLine(wx - offset, wy + winWidth * 0.5, wx + offset, wy + winWidth * 0.5, DXF_LAYERS.WINDOWS);
      break;
    }
  }

  return content;
}

module.exports = {
  generateDXF,
  DXF_LAYERS,
  DXF_COLORS,
};
