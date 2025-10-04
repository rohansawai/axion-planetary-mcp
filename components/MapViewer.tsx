/**
 * MapViewer Component
 * Renders an interactive Leaflet map with Earth Engine tiles
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapViewer.css';

// Fix Leaflet icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewerProps {
  mapData: {
    id: string;
    region: string;
    tileUrl: string;
    layers: Array<{
      name: string;
      tileUrl: string;
      visParams: any;
    }>;
    metadata: {
      center: [number, number];
      zoom: number;
      basemap: string;
    };
  };
}

const MapViewer: React.FC<MapViewerProps> = ({ mapData }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [showLayerControl, setShowLayerControl] = useState(false);
  const [layerReferences, setLayerReferences] = useState<Map<string, L.TileLayer>>(new Map());
  const [baseLayerReferences, setBaseLayerReferences] = useState<Map<string, L.TileLayer>>(new Map());
  const [layerVisibility, setLayerVisibility] = useState<Map<string, boolean>>(new Map());
  const [selectedBaseLayer, setSelectedBaseLayer] = useState<string>('');
  const [layerOpacity, setLayerOpacity] = useState<Map<string, number>>(new Map());


  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    // Initialize map
    const map = L.map(mapContainer.current, {
      center: [mapData.metadata.center[1], mapData.metadata.center[0]], // Leaflet uses [lat, lng]
      zoom: mapData.metadata.zoom,
      zoomControl: true,
      attributionControl: true
    });

    mapInstance.current = map;

    // Add base layers
    const baseLayers: { [key: string]: L.TileLayer } = {
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      }),
      'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap contributors',
        maxZoom: 17
      }),
      'Streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }),
      'Dark': L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; Stadia Maps',
        maxZoom: 20
      })
    };

    // Store base layer references
    const baseLayerMap = new Map<string, L.TileLayer>();
    Object.entries(baseLayers).forEach(([name, layer]) => {
      baseLayerMap.set(name, layer);
    });
    setBaseLayerReferences(baseLayerMap);

    // Add default base layer
    const defaultBasemap = mapData.metadata.basemap === 'dark' ? 'Dark' :
                          mapData.metadata.basemap === 'terrain' ? 'Terrain' :
                          mapData.metadata.basemap === 'roadmap' ? 'Streets' : 'Satellite';
    baseLayers[defaultBasemap].addTo(map);
    setSelectedBaseLayer(defaultBasemap);

    // Add Earth Engine layers
    const eeLayers: { [key: string]: L.TileLayer } = {};
    const layerMap = new Map<string, L.TileLayer>();
    const visibilityMap = new Map<string, boolean>();
    const opacityMap = new Map<string, number>();
    
    mapData.layers.forEach((layer, index) => {
      const isVisible = true; // Make all layers visible by default
      const initialOpacity = 0.8; // Default opacity when visible
      console.log(`Creating EE layer: ${layer.name}, visible: ${isVisible}, tileUrl: ${layer.tileUrl}`);
      
      const eeLayer = L.tileLayer(layer.tileUrl, {
        attribution: 'Google Earth Engine',
        maxZoom: 20,
        opacity: initialOpacity // Set to visible opacity
      });
      
      eeLayers[`EE: ${layer.name}`] = eeLayer;
      layerMap.set(layer.name, eeLayer);
      visibilityMap.set(layer.name, isVisible);
      opacityMap.set(layer.name, initialOpacity);
      
      // Add to map and make visible
      eeLayer.addTo(map);
      
      console.log(`Added layer ${layer.name} to map, opacity: ${eeLayer.options.opacity}, visible: ${isVisible}`);
    });
    
    setLayerReferences(layerMap);
    setLayerVisibility(visibilityMap);
    setLayerOpacity(opacityMap);
    
    // Note: Using custom layer control instead of Leaflet's built-in control

    // Add scale control
    L.control.scale({
      position: 'bottomright',
      metric: true,
      imperial: true
    }).addTo(map);

    // Add custom controls
    const customControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-controls');
        
        // Fullscreen button
        const fullscreenBtn = L.DomUtil.create('a', 'control-button', container);
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = 'Fullscreen';
        fullscreenBtn.href = '#';
        fullscreenBtn.onclick = (e) => {
          e.preventDefault();
          if (!document.fullscreenElement) {
            mapContainer.current?.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        };

        // Reset view button
        const resetBtn = L.DomUtil.create('a', 'control-button', container);
        resetBtn.innerHTML = '🏠';
        resetBtn.title = 'Reset View';
        resetBtn.href = '#';
        resetBtn.onclick = (e) => {
          e.preventDefault();
          map.setView(
            [mapData.metadata.center[1], mapData.metadata.center[0]],
            mapData.metadata.zoom
          );
        };

        // Info button
        const infoBtn = L.DomUtil.create('a', 'control-button', container);
        infoBtn.innerHTML = 'ℹ️';
        infoBtn.title = 'Map Info';
        infoBtn.href = '#';
        infoBtn.onclick = (e) => {
          e.preventDefault();
          const bounds = map.getBounds();
          const zoom = map.getZoom();
          alert(`Region: ${mapData.region}\nZoom: ${zoom}\nBounds:\n  North: ${bounds.getNorth().toFixed(4)}\n  South: ${bounds.getSouth().toFixed(4)}\n  East: ${bounds.getEast().toFixed(4)}\n  West: ${bounds.getWest().toFixed(4)}`);
        };

        return container;
      }
    });

    new customControl().addTo(map);

    // Handle window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstance.current = null;
    };
  }, [mapData]);

  // Click handler to toggle layer control
  const handleLayerControlToggle = () => {
    setShowLayerControl(!showLayerControl);
  };

  return (
    <>
      <div ref={mapContainer} className="map-container" />
      
      <div className="bottom-layer-control">
        <div className="current-layer-display">
          <button
            className="current-layer-btn"
            onClick={handleLayerControlToggle}
          >
            <div className="current-layer-info">
              {/* Base Layer */}
              <div className="base-layer-item">
                <button
                  className="base-layer-toggle-btn"
                  onClick={handleLayerControlToggle}
                >
                  <span className="base-layer-name">{selectedBaseLayer}</span>
                </button>
              </div>
              
              {/* EE Layers */}
              <div className="visible-ee-layers">
                {Array.from(layerVisibility.entries()).map(([layerName, isVisible]) => {
                  const layerRef = layerReferences.get(layerName);
                  return (
                    <div key={layerName} className="visible-layer-item">
                      <button
                        className={`layer-toggle-btn ${isVisible ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (layerRef) {
                            const newVisibility = !isVisible;
                            const targetOpacity = newVisibility ? 1 : 0;
                            console.log(`Toggling layer ${layerName}: ${isVisible} -> ${newVisibility}, opacity: ${targetOpacity}`);
                            
                            layerRef.setOpacity(targetOpacity);
                            
                            if (mapInstance.current) {
                              mapInstance.current.invalidateSize();
                            }
                            
                            setLayerVisibility(prev => {
                              const newMap = new Map(prev);
                              newMap.set(layerName, newVisibility);
                              return newMap;
                            });
                          } else {
                            console.error(`Layer reference not found for: ${layerName}`);
                          }
                        }}
                      >
                        <span className="visible-layer-name">{layerName}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </button>
        </div>

        {/* Base Layer Options - Only show when clicking base layer */}
        {showLayerControl && (
          <div className="hover-layer-options">
            <div className="base-layer-grid">
              {Array.from(baseLayerReferences.entries()).map(([name, layer]) => (
                <div key={name} className="base-layer-option">
                  <button
                    className={`base-layer-btn ${selectedBaseLayer === name ? 'active' : ''}`}
                    onClick={() => {
                      // Store current EE layer states before switching
                      const currentEEStates = new Map();
                      layerReferences.forEach((eeLayer, layerName) => {
                        const isVisible = layerVisibility.get(layerName) || false;
                        const opacity = layerOpacity.get(layerName) || 0.8;
                        currentEEStates.set(layerName, { isVisible, opacity });
                      });
                      
                      // Remove all base layers
                      baseLayerReferences.forEach((l) => {
                        if ((l as any)._map) l.remove();
                      });
                      
                      // Add selected base layer
                      layer.addTo(mapInstance.current!);
                      
                      // Update selected layer
                      setSelectedBaseLayer(name);
                      
                      // Re-add Earth Engine layers with their previous state
                      setTimeout(() => {
                        layerReferences.forEach((eeLayer, layerName) => {
                          const state = currentEEStates.get(layerName);
                          if (state) {
                            if ((eeLayer as any)._map) {
                              eeLayer.remove();
                            }
                            eeLayer.addTo(mapInstance.current!);
                            eeLayer.setOpacity(state.isVisible ? state.opacity : 0);
                          }
                        });
                        
                        if (mapInstance.current) {
                          mapInstance.current.invalidateSize();
                        }
                      }, 200);
                    }}
                  >
                    <div className="base-layer-icon">
                      {name === 'Satellite' ? (
                        <div className="satellite-icon">🛰️</div>
                      ) : name === 'Terrain' ? (
                        <div className="terrain-icon">🏔️</div>
                      ) : name === 'Streets' ? (
                        <div className="streets-icon">🛣️</div>
                      ) : (
                        <div className="dark-icon">🌙</div>
                      )}
                    </div>
                    <span className="base-layer-label">{name}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MapViewer;