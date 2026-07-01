# OSRS World Map 🗺️

An interactive Old School RuneScape world map built with Next.js, React-Leaflet, and TypeScript. Explore the world of Gielinor with authentic map tiles generated from the actual game cache.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/osrs-world-map)

## ✨ Features

- **🗺️ Interactive Map**: Fully interactive map with zoom, pan, and click coordinates
- **🎯 Accurate Coordinates**: Proper OSRS coordinate transformations (Leaflet ↔ Region ↔ Tile)
- **🎨 Authentic Rendering**: Real OSRS tiles generated from actual game cache data
- **🏗️ Multiple Planes**: Support for surface, underground, and sky levels
- **📱 Responsive Design**: Modern, mobile-friendly UI built with Tailwind CSS
- **⚡ Fast Performance**: Optimized tile serving with Next.js API routes

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (for tile generation)

### Quick Start

1. **Clone and install**:
```bash
git clone https://github.com/yourusername/osrs-world-map.git
cd osrs-world-map
npm install
```

2. **Run development server**:
```bash
npm run dev
```

3. **Open in browser**: [http://localhost:3000](http://localhost:3000)

### Easy IntelliJ / Gradle Run

From the project root on Windows:

```powershell
.\gradlew.bat run
```

Then open [http://localhost:3000](http://localhost:3000).

Useful Gradle tasks:

```powershell
.\gradlew.bat run
.\gradlew.bat dev
.\gradlew.bat verify
.\gradlew.bat lintNext
.\gradlew.bat typecheck
.\gradlew.bat testRegionTools
.\gradlew.bat nextBuild
```

In IntelliJ, refresh the root Gradle project and run the shared `RSMap Web App` run configuration, or run `Tasks > application > run`.

If you see `Missing required options: cachedir, xteapath, outputdir`, IntelliJ is running the Java tile-generator project instead of the web map. Switch to the root `RSMap Web App` configuration. The Java tile-generator `run` task is only for generating map images and requires explicit cache/XTEA/output arguments.

Suggested commit name:

```text
feat: add cache and region tools
```

### 🚀 Deploy to Vercel

The easiest way to deploy is using Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/osrs-world-map)

Or manually:
```bash
npm run build
# Deploy the .next folder to your hosting provider
```

### 🎮 Generating Real OSRS Tiles (Optional)

To use actual OSRS map data instead of placeholder tiles:

1. **Prerequisites**: Docker and Python 3 installed
2. **Clean build** (recommended):
```bash
npm run clean
npm run build:with-tiles
```

Or generate tiles only:
```bash
./scripts/generate-tiles.sh
```

**Note**: This downloads the latest OSRS cache (~500MB) and generates tiles for all planes. The process can take 1-3 hours depending on your system.

## Architecture

### Coordinate Systems

The application handles three coordinate systems:

1. **Leaflet Coordinates** (lng, lat): Map library coordinates
2. **OSRS Region Coordinates** (regionX, regionY): Each region is 64x64 game tiles
3. **OSRS Tile Coordinates**: Individual tiles with region + local position (0-63)

### Key Components

- **OSRSMap**: Main map component using React-Leaflet
- **Coordinate Utilities**: Transform between different coordinate systems
- **Cache Colors**: Handle OSRS HSL to RGB color conversion
- **Tile API**: Custom API route for generating map tiles

### File Structure

```
src/
├── app/
│   ├── api/tiles/[z]/[x]/[y]/route.ts  # Tile serving API
│   ├── globals.css                      # Global styles
│   ├── layout.tsx                       # Root layout
│   └── page.tsx                         # Main page
├── components/
│   ├── OSRSMap.tsx                      # Map component
│   └── MapSidebar.tsx                   # Interactive sidebar
└── lib/
    ├── coordinates.ts                   # Coordinate transformations
    └── cacheColors.ts                   # OSRS color utilities
tile_generator/
├── src/
│   └── tile_generator.py               # Python tile generator
├── java/
│   └── src/main/java/org/explv/mapimage/
│       └── Main.java                    # Java map image generator
├── Dockerfile                           # Docker container config
└── requirements.txt                     # Python dependencies
scripts/
└── generate-tiles.sh                   # Tile generation script
```

## Usage

### Basic Map Usage

The map supports standard interactions:
- **Zoom**: Mouse wheel or zoom controls
- **Pan**: Click and drag
- **Click**: Click anywhere to see coordinates
- **Labels**: Use `Labels On/Off` in the bottom bar to toggle world map labels
- **Region Grid**: Use `Grid On/Off` to toggle exact 64x64 region boundaries
- **Region Labels**: Use `Region Labels` and the dropdown to show `50_49`, `12849`, or both
- **Go Region**: Enter `50_49`, `12849`, `m50_49`, or `l50_49` and click `Go Region`
- **Z Planes**: Use `Plane` or the HUD `Z +` / `Z -` buttons to inspect planes 0-3
- **Plane Mode**: Use `Stacked 0-Z` to blend lower planes, or `Only Z` to show only the selected plane
- **Hover Coordinates**: Move the mouse over the map to see live world `X`, `Y`, `Z`, region, and local tile coordinates

### Coordinate Information

When you click on the map, you'll see:
- Leaflet coordinates (map library coordinates)
- OSRS Region coordinates 
- OSRS Tile coordinates (region + local tile position)

## Development

### Adding New Features

1. **Custom Overlays**: Add markers, shapes, or other overlays using React-Leaflet components
2. **Real Cache Data**: Replace the placeholder tile generation with actual OSRS cache data using `osrscachereader`
3. **Map Layers**: Add different map layers (surface, underground, etc.)

### Tile Generation

The current tile generation is a placeholder. For production use:

1. Use `osrscachereader` to load actual OSRS cache data
2. Implement proper underlay/overlay rendering
3. Add height-based shading and textures
4. Cache generated tiles for performance

## 🛠️ Tech Stack

- **[Next.js 14](https://nextjs.org/)**: React framework with App Router
- **[React-Leaflet](https://react-leaflet.js.org/)**: React components for Leaflet maps  
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework
- **[Leaflet](https://leafletjs.com/)**: Interactive map library
- **[RuneLite Cache](https://github.com/runelite/runelite)**: OSRS cache reading and tile generation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is for educational purposes. RuneScape is a trademark of Jagex Ltd.

## 🙏 Acknowledgments

- **[RuneLite](https://runelite.net/)**: MapImageDumper implementation
- **[OSRS Wiki](https://oldschool.runescape.wiki/)**: Coordinate system documentation  
- **[Explv's Map](https://github.com/Explv/osrs_map_tiles)**: Tile generation inspiration
- **[OpenRS2](https://www.openrs2.org/)**: OSRS cache archive

## 📸 Screenshots

*Add screenshots of your map in action here*

---

**Disclaimer**: This project is not affiliated with or endorsed by Jagex Ltd. RuneScape is a trademark of Jagex Ltd.
