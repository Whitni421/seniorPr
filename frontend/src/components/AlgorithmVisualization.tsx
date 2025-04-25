import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  useTheme,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';

interface DataPoint {
  day: number;
  rhr: number;
  hrv: number;
  phase: string;
  prediction_confidence: number;
}

const AlgorithmVisualization: React.FC = () => {
  const theme = useTheme();

  // Sample data to demonstrate the algorithm
  const sampleData: DataPoint[] = [
    { day: 1, rhr: 65, hrv: 45, phase: 'Menstrual', prediction_confidence: 0.85 },
    { day: 2, rhr: 64, hrv: 47, phase: 'Menstrual', prediction_confidence: 0.88 },
    { day: 3, rhr: 63, hrv: 48, phase: 'Menstrual', prediction_confidence: 0.90 },
    { day: 4, rhr: 62, hrv: 50, phase: 'Menstrual', prediction_confidence: 0.87 },
    { day: 5, rhr: 61, hrv: 52, phase: 'Menstrual', prediction_confidence: 0.85 },
    { day: 6, rhr: 60, hrv: 55, phase: 'Follicular', prediction_confidence: 0.82 },
    { day: 7, rhr: 61, hrv: 54, phase: 'Follicular', prediction_confidence: 0.84 },
    { day: 8, rhr: 62, hrv: 53, phase: 'Follicular', prediction_confidence: 0.86 },
    { day: 9, rhr: 63, hrv: 52, phase: 'Follicular', prediction_confidence: 0.85 },
    { day: 10, rhr: 64, hrv: 51, phase: 'Follicular', prediction_confidence: 0.83 },
    { day: 11, rhr: 65, hrv: 50, phase: 'Follicular', prediction_confidence: 0.81 },
    { day: 12, rhr: 66, hrv: 48, phase: 'Follicular', prediction_confidence: 0.80 },
    { day: 13, rhr: 67, hrv: 46, phase: 'Follicular', prediction_confidence: 0.82 },
    { day: 14, rhr: 68, hrv: 44, phase: 'Ovulatory', prediction_confidence: 0.89 },
    { day: 15, rhr: 69, hrv: 42, phase: 'Ovulatory', prediction_confidence: 0.91 },
    { day: 16, rhr: 68, hrv: 43, phase: 'Ovulatory', prediction_confidence: 0.88 },
    { day: 17, rhr: 67, hrv: 45, phase: 'Ovulatory', prediction_confidence: 0.85 },
    { day: 18, rhr: 66, hrv: 47, phase: 'Luteal', prediction_confidence: 0.83 },
    { day: 19, rhr: 65, hrv: 48, phase: 'Luteal', prediction_confidence: 0.85 },
    { day: 20, rhr: 64, hrv: 49, phase: 'Luteal', prediction_confidence: 0.87 },
    { day: 21, rhr: 63, hrv: 50, phase: 'Luteal', prediction_confidence: 0.86 },
    { day: 22, rhr: 64, hrv: 49, phase: 'Luteal', prediction_confidence: 0.84 },
    { day: 23, rhr: 65, hrv: 48, phase: 'Luteal', prediction_confidence: 0.83 },
    { day: 24, rhr: 66, hrv: 47, phase: 'Luteal', prediction_confidence: 0.82 },
    { day: 25, rhr: 67, hrv: 46, phase: 'Luteal', prediction_confidence: 0.81 },
    { day: 26, rhr: 68, hrv: 45, phase: 'Luteal', prediction_confidence: 0.80 },
    { day: 27, rhr: 67, hrv: 44, phase: 'Luteal', prediction_confidence: 0.82 },
    { day: 28, rhr: 66, hrv: 45, phase: 'Luteal', prediction_confidence: 0.83 },
  ];

  const getPhaseColor = (phase: string) => {
    switch (phase.toLowerCase()) {
      case 'menstrual':
        return '#FF4081';
      case 'follicular':
        return '#424242';
      case 'ovulatory':
        return '#757575';
      case 'luteal':
        return '#BDBDBD';
      default:
        return '#FFFFFF';
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, backgroundColor: '#FAFAFA' }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Algorithm Visualization: HRV & RHR Pattern Analysis
      </Typography>

      <Box sx={{ height: 500, mb: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={sampleData}
            margin={{ top: 30, right: 80, left: 80, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="day" 
              label={{ 
                value: 'Cycle Day', 
                position: 'bottom', 
                offset: 15,
                style: { fontSize: '14px' }
              }}
            />
            <YAxis 
              yAxisId="left"
              label={{ 
                value: 'Resting Heart Rate (bpm)', 
                angle: -90, 
                position: 'insideLeft',
                offset: 30,
                style: { fontSize: '14px' }
              }}
              domain={[55, 75]}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              label={{ 
                value: 'Heart Rate Variability', 
                angle: 90, 
                position: 'insideRight',
                offset: 30,
                style: { fontSize: '14px' }
              }}
              domain={[35, 60]}
            />
            <YAxis 
              yAxisId="confidence"
              orientation="right"
              hide={true}
              domain={[0, 1]}
            />
            {/* Add colored backgrounds for each phase */}
            {['Menstrual', 'Follicular', 'Ovulatory', 'Luteal'].map(phase => {
              const phaseData = sampleData.filter(d => d.phase === phase);
              if (phaseData.length === 0) return null;
              return (
                <ReferenceArea
                  key={phase}
                  x1={phaseData[0].day}
                  x2={phaseData[phaseData.length - 1].day}
                  fill={getPhaseColor(phase)}
                  fillOpacity={0.1}
                  ifOverflow="visible"
                />
              );
            })}
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === 'prediction_confidence') {
                  return [`${(value * 100).toFixed(1)}%`, 'Confidence'];
                }
                if (name === 'rhr') {
                  return [value, 'Resting Heart Rate (bpm)'];
                }
                if (name === 'hrv') {
                  return [value, 'Heart Rate Variability'];
                }
                return [value, name];
              }}
              contentStyle={{ 
                backgroundColor: '#FFFFFF',
                border: '1px solid #E0E0E0',
                borderRadius: '4px',
                padding: '12px',
                fontSize: '14px'
              }}
            />
            <Legend 
              verticalAlign="top" 
              height={50}
              wrapperStyle={{ 
                paddingBottom: '30px',
                fontSize: '14px'
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="rhr"
              name="RHR"
              stroke="#FF4081"
              strokeWidth={2}
              dot={{ fill: '#FF4081', r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="hrv"
              name="HRV"
              stroke="#424242"
              strokeWidth={2}
              dot={{ fill: '#424242', r: 4 }}
            />
            <Line
              yAxisId="confidence"
              type="monotone"
              dataKey="prediction_confidence"
              name="Prediction Confidence"
              stroke="#4CAF50"
              strokeWidth={3}
              strokeDasharray="8 8"
              dot={false}
            />
            
            {/* Add reference lines for phase transitions */}
            <ReferenceLine
              yAxisId="left"
              x={5}
              stroke="#FF4081"
              strokeDasharray="5 5"
              label={{ value: 'Menstrual → Follicular', angle: -90, position: 'insideRight' }}
            />
            <ReferenceLine
              yAxisId="left"
              x={13}
              stroke="#424242"
              strokeDasharray="5 5"
              label={{ value: 'Follicular → Ovulatory', angle: -90, position: 'insideRight' }}
            />
            <ReferenceLine
              yAxisId="left"
              x={17}
              stroke="#757575"
              strokeDasharray="5 5"
              label={{ value: 'Ovulatory → Luteal', angle: -90, position: 'insideRight' }}
            />

            {/* Add reference lines for typical HRV/RHR thresholds */}
            <ReferenceLine
              yAxisId="left"
              y={65}
              stroke="#FF4081"
              strokeDasharray="3 3"
              label={{ value: 'Typical RHR Threshold', position: 'left' }}
            />
            <ReferenceLine
              yAxisId="right"
              y={50}
              stroke="#424242"
              strokeDasharray="3 3"
              label={{ value: 'Typical HRV Threshold', position: 'right' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          How the Algorithm Works
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Paper sx={{ p: 2, bgcolor: '#F5F5F5' }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              1. Data Collection & Thresholds
            </Typography>
            <Typography variant="body2">
              Daily HRV and RHR measurements are collected and compared against typical thresholds (shown as dashed horizontal lines). These thresholds help identify significant changes in your metrics that indicate phase transitions.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, bgcolor: '#F5F5F5' }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              2. Pattern Recognition & Phase Transitions
            </Typography>
            <Typography variant="body2">
              • Menstrual → Follicular (Day 5-6): RHR starts decreasing, HRV begins to rise
              <br />
              • Follicular → Ovulatory (Day 13-14): Sharp RHR increase, HRV drops
              <br />
              • Ovulatory → Luteal (Day 17-18): Both metrics stabilize
              <br />
              • Vertical dashed lines mark typical transition points
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, bgcolor: '#F5F5F5' }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              3. Confidence Calculation
            </Typography>
            <Typography variant="body2">
              The green dashed line shows prediction confidence (0-100%). Confidence is highest when your metrics strongly match expected patterns for each phase. Transitions between phases often show temporary drops in confidence as your body shifts between states.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, bgcolor: '#F5F5F5' }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              4. Continuous Learning & Adaptation
            </Typography>
            <Typography variant="body2">
              Your personal thresholds are continuously refined based on your historical data. The algorithm learns your unique patterns and adjusts predictions accordingly, leading to improved accuracy over time.
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Paper>
  );
};

export default AlgorithmVisualization; 