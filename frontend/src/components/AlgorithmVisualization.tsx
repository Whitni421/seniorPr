import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  useTheme,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Tooltip as MuiTooltip,
  IconButton,
  Chip,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
  Area,
} from 'recharts';
import axios from 'axios';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { format, subDays } from 'date-fns';

interface DataPoint {
  day: number;
  rhr: number;
  hrv: number;
  phase: string;
  prediction_confidence: number;
  date: string;
}

interface HRData {
  date: string;
  hrv_status: number;
  rhr: number;
}

interface MenstrualPhase {
  date: string;
  cycle_day: number;
  predicted_phase: string;
  start_date: string;
}

interface PhaseStats {
  name: string;
  avgRHR: number;
  avgHRV: number;
  count: number;
}

// Helper function to get expected cycle days for each phase
const getExpectedDaysForPhase = (phase: string): number[] => {
  switch (phase.toLowerCase()) {
    case 'menstrual':
      return [1, 2, 3, 4, 5, 6, 7];
    case 'follicular':
      return [8, 9, 10, 11, 12, 13];
    case 'ovulatory':
      return [14, 15, 16];
    case 'luteal':
      return [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
    default:
      return [];
  }
};

const AlgorithmVisualization: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseStats, setPhaseStats] = useState<PhaseStats[]>([]);
  const [trends, setTrends] = useState<{
    rhr: { direction: 'up' | 'down' | 'stable'; value: number };
    hrv: { direction: 'up' | 'down' | 'stable'; value: number };
  }>({ rhr: { direction: 'stable', value: 0 }, hrv: { direction: 'stable', value: 0 } });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const user_id = localStorage.getItem('user_id');

        if (!token || !user_id) {
          setError('User not authenticated');
          setLoading(false);
          return;
        }

        // Fetch HR data
        const hrResponse = await axios.get(`/api/hr_data?user_id=${user_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const hrData: HRData[] = hrResponse.data;

        // Fetch menstrual phases
        const phasesResponse = await axios.get(`/api/menstrual_phases?user_id=${user_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const phases: MenstrualPhase[] = phasesResponse.data;

        // Combine and transform the data
        const combinedData = hrData.map((hr, index) => {
          const phase = phases.find(p => p.date === hr.date);
          
          // Calculate confidence based on cycle day consistency
          let confidence = 0;
          if (phase) {
            // If the cycle day is within expected range for the phase
            const expectedDays = getExpectedDaysForPhase(phase.predicted_phase);
            if (expectedDays.includes(phase.cycle_day)) {
              confidence = 1.0;
            } else if (Math.abs(phase.cycle_day - expectedDays[0]) <= 2) {
              confidence = 0.7;
            } else {
              confidence = 0.3;
            }
          }

          return {
            day: index + 1,
            rhr: hr.rhr,
            hrv: hr.hrv_status,
            phase: phase?.predicted_phase || 'Unknown',
            prediction_confidence: confidence,
            date: hr.date,
          };
        });

        // Calculate phase statistics
        const stats = calculatePhaseStats(combinedData);
        setPhaseStats(stats);

        // Calculate trends
        const trends = calculateTrends(combinedData);
        setTrends(trends);

        setData(combinedData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculatePhaseStats = (data: DataPoint[]): PhaseStats[] => {
    const phaseMap = new Map<string, { rhr: number[]; hrv: number[] }>();
    
    data.forEach(point => {
      if (!phaseMap.has(point.phase)) {
        phaseMap.set(point.phase, { rhr: [], hrv: [] });
      }
      const stats = phaseMap.get(point.phase)!;
      stats.rhr.push(point.rhr);
      stats.hrv.push(point.hrv);
    });

    return Array.from(phaseMap.entries()).map(([phase, stats]) => ({
      name: phase,
      avgRHR: stats.rhr.reduce((a, b) => a + b, 0) / stats.rhr.length,
      avgHRV: stats.hrv.reduce((a, b) => a + b, 0) / stats.hrv.length,
      count: stats.rhr.length,
    }));
  };

  const calculateTrends = (data: DataPoint[]): { rhr: { direction: 'up' | 'down' | 'stable'; value: number }; hrv: { direction: 'up' | 'down' | 'stable'; value: number } } => {
    if (data.length < 2) {
      return { rhr: { direction: 'stable', value: 0 }, hrv: { direction: 'stable', value: 0 } };
    }

    const lastWeek = data.slice(-7);
    const firstHalf = lastWeek.slice(0, 3);
    const secondHalf = lastWeek.slice(-3);

    const calculateTrend = (values: DataPoint[], key: 'rhr' | 'hrv') => {
      const firstAvg = values.reduce((sum, point) => sum + point[key], 0) / values.length;
      const secondAvg = secondHalf.reduce((sum, point) => sum + point[key], 0) / secondHalf.length;
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      
      if (Math.abs(change) < 2) return { direction: 'stable' as const, value: change };
      return { direction: change > 0 ? 'up' : 'down' as const, value: change };
    };

    return {
      rhr: calculateTrend(lastWeek, 'rhr'),
      hrv: calculateTrend(lastWeek, 'hrv'),
    };
  };

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper elevation={3} sx={{ p: 3, backgroundColor: '#FAFAFA' }}>
        <Typography color="error">{error}</Typography>
      </Paper>
    );
  }

  if (data.length === 0) {
    return (
      <Paper elevation={3} sx={{ p: 3, backgroundColor: '#FAFAFA' }}>
        <Typography>No data available yet. Please check back later.</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, backgroundColor: '#FAFAFA' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Your HRV & RHR Pattern Analysis
        </Typography>
        <MuiTooltip title="This chart shows your heart rate variability (HRV) and resting heart rate (RHR) patterns over time, with menstrual cycle phases highlighted">
          <IconButton>
            <InfoIcon />
          </IconButton>
        </MuiTooltip>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                Resting Heart Rate Trend
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {trends.rhr.direction === 'up' ? (
                  <TrendingUpIcon color="error" />
                ) : trends.rhr.direction === 'down' ? (
                  <TrendingDownIcon color="success" />
                ) : (
                  <TrendingUpIcon color="disabled" />
                )}
                <Typography variant="h6">
                  {Math.abs(trends.rhr.value).toFixed(1)}% {trends.rhr.direction}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                HRV Trend
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {trends.hrv.direction === 'up' ? (
                  <TrendingUpIcon color="success" />
                ) : trends.hrv.direction === 'down' ? (
                  <TrendingDownIcon color="error" />
                ) : (
                  <TrendingUpIcon color="disabled" />
                )}
                <Typography variant="h6">
                  {Math.abs(trends.hrv.value).toFixed(1)}% {trends.hrv.direction}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ height: 500, mb: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 30, right: 100, left: 100, bottom: 50 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis 
              dataKey="day" 
              label={{ 
                value: 'Day', 
                position: 'bottom', 
                offset: 30,
                style: { fontSize: '14px' }
              }}
              tick={{ fill: '#424242' }}
              interval={2}
            />
            <YAxis 
              yAxisId="left"
              label={{ 
                value: 'Resting Heart Rate (bpm)', 
                angle: -90, 
                position: 'insideLeft',
                offset: 50,
                style: { fontSize: '14px' }
              }}
              domain={['dataMin - 5', 'dataMax + 5']}
              tick={{ fill: '#424242' }}
              tickCount={5}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              label={{ 
                value: 'Heart Rate Variability', 
                angle: 90, 
                position: 'insideRight',
                offset: 50,
                style: { fontSize: '14px' }
              }}
              domain={['dataMin - 5', 'dataMax + 5']}
              tick={{ fill: '#424242' }}
              tickCount={5}
            />
            <YAxis 
              yAxisId="confidence"
              orientation="right"
              label={{ 
                value: 'Confidence', 
                angle: 90, 
                position: 'insideRight',
                offset: 100,
                style: { fontSize: '14px' }
              }}
              domain={[0, 1]}
              tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
              tick={{ fill: '#4CAF50' }}
              tickCount={5}
            />
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
              name="Resting Heart Rate"
              stroke="#FF4081"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="hrv"
              name="Heart Rate Variability"
              stroke="#424242"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
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
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Phase Statistics
        </Typography>
        
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {phaseStats.map((stat) => (
            <Grid item xs={12} sm={6} md={3} key={stat.name}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    {stat.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg RHR: {stat.avgRHR.toFixed(1)} bpm
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg HRV: {stat.avgHRV.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Data Points: {stat.count}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
};

export default AlgorithmVisualization; 