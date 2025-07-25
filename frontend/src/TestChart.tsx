import { useEffect, useRef } from 'react';
import LWC from 'lightweight-charts';
console.log('LWC default import:', LWC);

export default function TestChart() {
  const ref = useRef(null);
  useEffect(() => {
    if (!LWC.createChart) {
      console.error('LWC.createChart is not available:', LWC);
      return;
    }
    const chart = LWC.createChart(ref.current, { height: 300 });
    console.log('TestChart object:', chart, 'Methods:', Object.keys(chart));
    if (!chart.addLineSeries) {
      console.error('chart.addLineSeries is not available:', chart);
      return;
    }
    const series = chart.addLineSeries();
    series.setData([
      { time: 1640995200, value: 100 },
      { time: 1641081600, value: 110 },
    ]);
  }, []);
  return <div ref={ref} style={{ width: 400, height: 300 }} />;
} 