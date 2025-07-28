import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, UTCTimestamp } from 'lightweight-charts';

interface ChartComponentProps {
  data: CandleData[];
  symbol?: string;
  interval?: string;
}

interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Transform API data to lightweight-charts format
const transformData = (data: any[]): CandleData[] => {
  return data.map((item) => ({
    time: Math.floor(new Date(item.datetime).getTime() / 1000) as UTCTimestamp,
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseFloat(item.volume) || 0,
  }));
};

// Format time based on interval
const formatTime = (timestamp: number, interval: string): string => {
  const date = new Date(timestamp * 1000);
  
  switch (interval) {
    case '1minute':
    case '5minute':
    case '30minute':
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    case '1day':
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric' 
      });
    default:
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
  }
};

// Calculate optimal zoom level based on interval and data length
const getOptimalZoomLevel = (interval: string, dataLength: number): number => {
  switch (interval) {
    case '1minute':
      return Math.min(3, Math.max(1, 20 / dataLength));
    case '5minute':
      return Math.min(4, Math.max(1, 15 / dataLength));
    case '30minute':
      return Math.min(5, Math.max(1, 10 / dataLength));
    case '1day':
      return Math.min(6, Math.max(1, 5 / dataLength));
    default:
      return Math.min(3, Math.max(1, 20 / dataLength));
  }
};

// Fallback chart using HTML5 Canvas with zoom functionality
const FallbackChart: React.FC<{ 
  data: CandleData[]; 
  symbol: string; 
  interval: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
}> = ({ data, symbol, interval, zoomLevel, onZoomChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;

    // Clear canvas
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);

    // Find min/max values
    const prices = data.flatMap(d => [d.low, d.high]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Apply zoom and pan
    const visibleDataPoints = Math.max(10, Math.floor(data.length / zoomLevel));
    const candleWidth = Math.max(2, chartWidth / visibleDataPoints - 1);
    const startIndex = Math.max(0, Math.floor(panOffset));
    const endIndex = Math.min(data.length, startIndex + visibleDataPoints);
    const visibleData = data.slice(startIndex, endIndex);

    // Draw grid
    ctx.strokeStyle = '#1e2329';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw price labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    for (let i = 0; i <= 5; i++) {
      const price = maxPrice - (i * priceRange) / 5;
      const y = padding + (i * chartHeight) / 5;
      ctx.fillText(price.toFixed(2), 5, y + 4);
    }

    // Draw time labels
    const timeLabelInterval = Math.max(1, Math.floor(visibleData.length / 8));
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    for (let i = 0; i < visibleData.length; i += timeLabelInterval) {
      const x = padding + (i * chartWidth / visibleData.length);
      const timeLabel = formatTime(visibleData[i].time, interval);
      ctx.fillText(timeLabel, x + candleWidth / 2, height - 10);
    }
    ctx.textAlign = 'left';

    // Draw candlesticks
    visibleData.forEach((candle, index) => {
      const x = padding + (index * chartWidth / visibleData.length);
      const isGreen = candle.close > candle.open;
      
      // Wick
      const wickY1 = padding + ((maxPrice - candle.high) * chartHeight) / priceRange;
      const wickY2 = padding + ((maxPrice - candle.low) * chartHeight) / priceRange;
      ctx.strokeStyle = isGreen ? '#00d4aa' : '#ff444f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, wickY1);
      ctx.lineTo(x + candleWidth / 2, wickY2);
      ctx.stroke();

      // Body
      const bodyY1 = padding + ((maxPrice - Math.max(candle.open, candle.close)) * chartHeight) / priceRange;
      const bodyY2 = padding + ((maxPrice - Math.min(candle.open, candle.close)) * chartHeight) / priceRange;
      const bodyHeight = bodyY2 - bodyY1;
      
      ctx.fillStyle = isGreen ? '#00d4aa' : '#ff444f';
      ctx.fillRect(x, bodyY1, candleWidth, bodyHeight);
    });

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(symbol, padding, 25);
    ctx.font = '12px Arial';
    ctx.fillText(`Data points: ${data.length} | Interval: ${interval} | Zoom: ${zoomLevel.toFixed(1)}x`, padding, 40);

  }, [data, symbol, interval, zoomLevel, panOffset]);

  // Mouse event handlers for zoom and pan
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      setPanOffset(prev => Math.max(0, prev - deltaX / 10));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    onZoomChange(Math.max(0.5, Math.min(10, zoomLevel * zoomDelta)));
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          width: '100%',
          height: '500px',
          borderRadius: '8px',
          border: '1px solid #2a2f35',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};

const ChartComponent: React.FC<ChartComponentProps> = ({ data, symbol = 'Chart', interval = '1minute' }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const candles = transformData(data);
  const hasData = data && data.length > 0;

  // Auto-adjust zoom based on interval when it changes
  useEffect(() => {
    const optimalZoom = getOptimalZoomLevel(interval, candles.length);
    setZoomLevel(optimalZoom);
  }, [interval, candles.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChart();
    };
  }, [cleanupChart]);

  // Cleanup function
  const cleanupChart = useCallback(() => {
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      } catch (e) {
        console.error('Error cleaning up chart:', e);
      }
    }
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    try {
      console.log('Creating chart with data length:', candles.length);

      // Cleanup existing chart
      cleanupChart();

      // Create chart instance
      const chart = createChart(chartRef.current, {
        layout: {
          background: { color: '#0f1419' },
          textColor: '#ffffff',
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        grid: {
          vertLines: { color: '#1e2329', style: 1 },
          horzLines: { color: '#1e2329', style: 1 },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#00d4aa',
            width: 1,
            style: 3, // Dotted
            labelBackgroundColor: '#1e2329',
          },
          horzLine: {
            color: '#00d4aa',
            width: 1,
            style: 3, // Dotted
            labelBackgroundColor: '#1e2329',
          },
        },
        timeScale: {
          borderColor: '#2B2B43',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: Math.max(1, 3 * zoomLevel), // Apply zoom to bar spacing
          fixLeftEdge: true,
          lockVisibleTimeRangeOnResize: true,
          rightBarStaysOnScroll: true,
          borderVisible: false,
          visible: true,
          tickMarkFormatter: (time: number) => {
            return formatTime(time, interval);
          },
        },
        rightPriceScale: {
          borderColor: '#2B2B43',
          scaleMargins: {
            top: 0.1,
            bottom: showVolume ? 0.25 : 0.1,
          },
          borderVisible: false,
          visible: true,
          autoScale: true,
        },
        leftPriceScale: {
          visible: false,
        },
        width: chartRef.current.clientWidth,
        height: 500,
      });

      console.log('Chart created successfully');

      chartInstanceRef.current = chart;

      // Add candlestick series using the v5 API
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00d4aa',
        downColor: '#ff444f',
        wickUpColor: '#00d4aa',
        wickDownColor: '#ff444f',
        borderUpColor: '#00d4aa',
        borderDownColor: '#ff444f',
        borderVisible: true,
      });

      candleSeriesRef.current = candleSeries;

      // Set candlestick data
      const candlestickData: CandlestickData[] = candles.map((candle) => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      candleSeries.setData(candlestickData);

      // Add volume series if enabled
      if (showVolume) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: '#4e5b85',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        });

        volumeSeriesRef.current = volumeSeries;

                  const volumeData: HistogramData[] = candles.map((candle) => ({
            time: candle.time,
            value: candle.volume,
            color: candle.close > candle.open ? '#00d4aa' : '#ff444f',
          }));

          volumeSeries.setData(volumeData);
      }

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (chartRef.current && chartInstanceRef.current) {
          chartInstanceRef.current.applyOptions({ 
            width: chartRef.current.clientWidth 
          });
        }
      });

      resizeObserver.observe(chartRef.current);

      return () => {
        chart.remove();
        resizeObserver.disconnect();
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    } catch (err) {
      console.error('Error creating chart:', err);
      setError(`Chart creation failed: ${err instanceof Error ? err.message : String(err)}`);
      setUseFallback(true);
    }
  }, [candles, showVolume, interval, zoomLevel, cleanupChart]);

  // Update zoom level for lightweight-charts
  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.applyOptions({
        timeScale: {
          barSpacing: Math.max(1, 3 * zoomLevel),
        },
      });
    }
  }, [zoomLevel]);

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(10, prev * 1.2));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(0.5, prev / 1.2));
  };

  const handleResetZoom = () => {
    const optimalZoom = getOptimalZoomLevel(interval, candles.length);
    setZoomLevel(optimalZoom);
  };

  if (error && useFallback) {
    return (
      <div className="bg-[#0f1419] border border-gray-700 rounded-lg p-4">
        <div className="mb-2 text-white font-semibold">{symbol}</div>
        <div className="text-xs text-gray-400 mb-4">Data points: {data.length}</div>
        <div className="text-xs text-yellow-400 mb-4">
          Using fallback chart (lightweight-charts failed to load)
        </div>
        
        {/* Zoom Controls for Fallback */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300 hover:bg-[#2a2f35] transition"
            title="Zoom Out"
          >
            🔍−
          </button>
          <button
            onClick={handleResetZoom}
            className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300 hover:bg-[#2a2f35] transition"
            title="Reset Zoom"
          >
            🔍
          </button>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300 hover:bg-[#2a2f35] transition"
            title="Zoom In"
          >
            🔍+
          </button>
          <div className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300">
            {zoomLevel.toFixed(1)}x
          </div>
        </div>
        
        <FallbackChart 
          data={candles} 
          symbol={symbol} 
          interval={interval}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0f1419] border border-gray-700 rounded-lg p-4 text-center text-red-400">
        <div className="font-semibold mb-2">Chart Error</div>
        <div className="text-sm">{error}</div>
        <div className="text-xs mt-2 text-gray-500">
          Please check the console for more details
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="bg-[#0f1419] border border-gray-700 rounded-lg p-4 text-center text-gray-400">
        No data available for chart
      </div>
    );
  }

  return (
    <div className="bg-[#0f1419] border border-gray-700 rounded-lg p-4">
      {/* Chart Header */}
      <div className="mb-2 text-white font-semibold">{symbol}</div>
      <div className="text-xs text-gray-400 mb-4">
        Data points: {data.length} | Interval: {interval}
      </div>
      
      {/* Controls Row */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* Volume Toggle */}
        <button
          onClick={() => setShowVolume(!showVolume)}
          className={`px-3 py-1 rounded text-xs font-semibold transition ${
            showVolume 
              ? 'bg-[#00d4aa] text-black' 
              : 'bg-[#1e2329] text-gray-300 hover:bg-[#2a2f35]'
          }`}
        >
          Volume
        </button>

        {/* Zoom Controls */}
        <button
          onClick={handleZoomOut}
          className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300 hover:bg-[#2a2f35] transition"
          title="Zoom Out"
        >
          🔍−
        </button>
        <button
          onClick={handleResetZoom}
          className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300 hover:bg-[#2a2f35] transition"
          title="Reset Zoom"
        >
          🔍
        </button>
        <button
          onClick={handleZoomIn}
          className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300 hover:bg-[#2a2f35] transition"
          title="Zoom In"
        >
          🔍+
        </button>
        <div className="px-3 py-1 rounded text-xs font-semibold bg-[#1e2329] text-gray-300">
          {zoomLevel.toFixed(1)}x
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={chartRef}
        style={{
          width: '100%',
          height: '500px',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />
      
      {/* Chart Info */}
      <div className="mt-2 text-xs text-gray-400">
        Professional candlestick chart with volume | Time format: {interval === '1day' ? 'Date' : 'Time'} | 
        Use mouse wheel to zoom, drag to pan
      </div>
    </div>
  );
};

export default ChartComponent; 