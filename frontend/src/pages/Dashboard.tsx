import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Container,
  Grid,
  Alert,
  CircularProgress,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
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
  Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import axios from 'axios';
import Logo from '../components/Logo';
import AlgorithmVisualization from '../components/AlgorithmVisualization';

interface HRData {
  id: string;
  date: string;
  hrv_status: number;
  rhr: number;
  user_id: string;
}

interface MenstrualPhase {
  id: string;
  date: string;
  predicted_phase: string;
  cycle_day: number;
  user_id: string;
}

interface Activity {
  id: string;
  activity_name: string;
  activity_type: string;
  start_time: string;
  duration: number;
  calories: number;
  average_hr: number;
  max_hr: number;
  distance: number;
  average_speed: number;
  elevation_gain: number;
  elevation_loss: number;
  total_sets?: number;
  total_reps?: number;
}

interface PhaseRange {
  phase: string;
  startDate: string;
  endDate: string;
  color: string;
}

interface ChartDataPoint {
  date: string;
  fullDate: string;
  rhr: number;
  hrv: number;
  phase: string | null;
  phaseColor: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [hrData, setHRData] = useState<HRData[]>([]);
  const [menstrualPhases, setMenstrualPhases] = useState<MenstrualPhase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingHRData, setLoadingHRData] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Get the token from localStorage
  const token = localStorage.getItem('token');
  const user_id = localStorage.getItem('user_id');

  // Configure axios to include the token in all requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  useEffect(() => {
    // Check if user just registered (within last minute)
    const registrationTime = localStorage.getItem('registrationTime');
    if (registrationTime && Date.now() - parseInt(registrationTime) < 60000) {
      setIsNewUser(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingHRData(true);
    setLoadingPhases(true);
    try {
      const [hrDataRes, phasesRes] = await Promise.all([
        axios.get(`http://localhost:3001/api/hr_data?user_id=${user_id}`),
        axios.get(`http://localhost:3001/api/menstrual_phases?user_id=${user_id}`)
      ]);

      setHRData(hrDataRes.data);
      setMenstrualPhases(phasesRes.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Please log in again');
      } else {
        setError('Failed to fetch data');
      }
    } finally {
      setLoadingHRData(false);
      setLoadingPhases(false);
    }
  };

  const formatChartData = (hrData: HRData[], phases: MenstrualPhase[]): ChartDataPoint[] => {
    // Sort both arrays by date
    const sortedHRData = [...hrData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedPhases = [...phases].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Create a map of dates to phases
    const phaseMap = new Map(sortedPhases.map(p => [p.date, p]));

    return sortedHRData.map(d => ({
      date: format(parseISO(d.date), 'MMM dd'),
      fullDate: d.date, // Keep the full date for phase matching
      rhr: d.rhr,
      hrv: d.hrv_status,
      phase: phaseMap.get(d.date)?.predicted_phase || null,
      phaseColor: getPhaseColor(phaseMap.get(d.date)?.predicted_phase)
    }));
  };

  const getPhaseColor = (phase: string | undefined | null) => {
    if (!phase) return '#FFFFFF';
    switch (phase.toLowerCase()) {
      case 'menstrual':
        return '#FF408140'; // Pink with 40% opacity
      case 'follicular':
        return '#42424240'; // Dark grey with 40% opacity
      case 'ovulatory':
        return '#75757540'; // Medium grey with 40% opacity
      case 'luteal':
        return '#BDBDBD40'; // Light grey with 40% opacity
      default:
        return '#FFFFFF00';
    }
  };

  const renderCycleCircle = () => {
    if (loadingPhases) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
          <CircularProgress sx={{ color: '#FF4081' }} />
        </Box>
      );
    }

    if (!menstrualPhases.length) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
          <Typography sx={{ color: '#757575' }}>No cycle data available</Typography>
        </Box>
      );
    }

    const currentPhase = menstrualPhases[menstrualPhases.length - 1];
    const cycleLength = 28; // Standard cycle length
    const phases = [
      { name: 'Menstrual', days: [1, 2, 3, 4, 5], color: '#FF4081' },     // Bright pink
      { name: 'Follicular', days: [6, 7, 8, 9, 10, 11, 12, 13], color: '#424242' },  // Dark grey
      { name: 'Ovulatory', days: [14, 15, 16, 17], color: '#757575' },    // Medium grey
      { name: 'Luteal', days: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28], color: '#BDBDBD' }  // Light grey
    ];

    return (
      <Box sx={{ 
        position: 'relative', 
        width: '100%', 
        paddingTop: '100%',
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: '50%',
            border: '2px solid #E0E0E0',
            overflow: 'hidden',
            background: '#FAFAFA',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          {phases.map((phase) => (
            <Box key={phase.name}>
              {phase.days.map((day) => {
                const isCurrentDay = currentPhase.cycle_day === day;
                const startAngle = ((day - 1) * 360) / cycleLength;
                const endAngle = (day * 360) / cycleLength;
                const radius = 50;

                // Calculate coordinates for the segment
                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);
                
                const x1 = radius + radius * Math.cos(startRad);
                const y1 = radius + radius * Math.sin(startRad);
                const x2 = radius + radius * Math.cos(endRad);
                const y2 = radius + radius * Math.sin(endRad);

                const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

                return (
                  <Box
                    key={day}
                    sx={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      '& svg': {
                        width: '100%',
                        height: '100%',
                        transform: 'rotate(-90deg)',
                      }
                    }}
                  >
                    <svg viewBox="0 0 100 100">
                      <path
                        d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L 50 50 Z`}
                        fill={phase.color}
                        opacity={isCurrentDay ? 1 : 0.9}
                      />
                      {isCurrentDay && (
                        <circle
                          cx={x2}
                          cy={y2}
                          r="2"
                          fill="#FFFFFF"
                          stroke={phase.color}
                          strokeWidth="1.5"
                        />
                      )}
                    </svg>
                  </Box>
                );
              })}
              <Typography
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${((phase.days[0] + phase.days[phase.days.length - 1]) / 2 - 1) * (360 / cycleLength)}deg) translateX(72%) rotate(-${((phase.days[0] + phase.days[phase.days.length - 1]) / 2 - 1) * (360 / cycleLength)}deg)`,
                  color: phase.color === '#424242' || phase.color === '#757575' ? '#FFFFFF' : phase.color,
                  fontWeight: '500',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  opacity: 1,
                  textShadow: phase.color === '#424242' || phase.color === '#757575' ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                {/* {phase.name} */}
              </Typography>
            </Box>
          ))}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              padding: '15px',
              borderRadius: '50%',
              width: '130px',
              height: '130px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography 
              sx={{ 
                color: '#FF4081',
                fontSize: '32px',
                fontWeight: '500',
                lineHeight: 1.2,
                mb: 1
              }}
            >
              Day {currentPhase.cycle_day}
            </Typography>
            <Typography 
              sx={{ 
                color: '#424242',
                fontSize: '14px',
                fontWeight: '400',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {currentPhase.predicted_phase}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    navigate('/');
  };

  useEffect(() => {
    const fetchActivities = async () => {
      setLoadingActivities(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found in localStorage');
          setError('Please log in again');
          navigate('/');
          return;
        }

        console.log('Fetching activities with token:', token);
        const response = await axios.get('http://localhost:3001/api/activities', {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Activities response:', response.data);
        setActivities(response.data);
      } catch (err) {
        console.error('Error fetching activities:', err);
        if (axios.isAxiosError(err)) {
          console.error('Error details:', {
            status: err.response?.status,
            data: err.response?.data,
            headers: err.response?.headers
          });
          if (err.response?.status === 403) {
            setError('Session expired. Please log in again');
            navigate('/');
          } else {
            setError('Failed to load activities');
          }
        } else {
          setError('Failed to load activities');
        }
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [navigate]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const renderLoadingSkeleton = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
      <CircularProgress sx={{ color: '#FF4081' }} />
    </Box>
  );

  const renderHRChart = () => {
    if (loadingHRData) {
      return renderLoadingSkeleton();
    }

    if (!hrData.length) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
          <Typography sx={{ color: '#757575' }}>No heart rate data available</Typography>
        </Box>
      );
    }

    const chartData = formatChartData(hrData, menstrualPhases);
    let currentPhase: string | null = null;
    const phaseRanges: PhaseRange[] = [];

    // Calculate phase ranges for the reference areas
    chartData.forEach((point, index) => {
      if (point.phase !== currentPhase) {
        if (currentPhase !== null) {
          phaseRanges.push({
            phase: currentPhase,
            startDate: chartData[Math.max(0, index - 1)].date,
            endDate: point.date,
            color: getPhaseColor(currentPhase)
          });
        }
        currentPhase = point.phase;
      }
      
      // Handle the last phase
      if (index === chartData.length - 1 && currentPhase) {
        phaseRanges.push({
          phase: currentPhase,
          startDate: point.date,
          endDate: point.date,
          color: getPhaseColor(currentPhase)
        });
      }
    });

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 20,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
          {phaseRanges.map((range, index) => (
            <ReferenceArea
              key={index}
              x1={range.startDate}
              x2={range.endDate}
              fill={range.color}
              ifOverflow="visible"
            />
          ))}
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fill: '#424242' }}
          />
          <YAxis
            yAxisId="left"
            label={{ 
              value: 'Resting Heart Rate', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: '#424242' }
            }}
            tick={{ fill: '#424242' }}
            domain={[0, 100]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ 
              value: 'HRV Status', 
              angle: 90, 
              position: 'insideRight',
              style: { textAnchor: 'middle', fill: '#424242' }
            }}
            tick={{ fill: '#424242' }}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#FFFFFF',
              border: '1px solid #E0E0E0',
            }}
            formatter={(value: any, name: string) => {
              if (name === 'phase') {
                return [value || 'Unknown', 'Phase'];
              }
              return [value, name === 'rhr' ? 'RHR' : 'HRV'];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="rhr"
            name="RHR"
            stroke="#FF4081"
            strokeWidth={2}
            dot={{ fill: '#FF4081', r: 4 }}
            activeDot={{ r: 6, fill: '#FF4081' }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="hrv"
            name="HRV"
            stroke="#424242"
            strokeWidth={2}
            dot={{ fill: '#424242', r: 4 }}
            activeDot={{ r: 6, fill: '#424242' }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderCurrentPhase = () => {
    if (loadingPhases) {
      return (
        <Box sx={{ p: 3 }}>
          <Skeleton variant="text" width="60%" height={40} sx={{ bgcolor: '#FF4081' }} />
          <Skeleton variant="text" width="40%" height={30} sx={{ mt: 2 }} />
          <Skeleton variant="text" width="50%" height={20} sx={{ mt: 2 }} />
        </Box>
      );
    }

    if (!menstrualPhases.length) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '200px' }}>
          <Typography sx={{ color: '#757575' }}>No phase data available</Typography>
        </Box>
      );
    }

    const currentPhase = menstrualPhases[menstrualPhases.length - 1];
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ 
          color: '#FF4081',
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {currentPhase.predicted_phase}
        </Typography>
        <Typography sx={{ color: '#424242' }}>
          Day {currentPhase.cycle_day} of your cycle
        </Typography>
        <Typography variant="body2" sx={{ color: '#757575' }}>
          {format(parseISO(currentPhase.date), 'MMMM d, yyyy')}
        </Typography>
      </Box>
    );
  };

  const renderActivities = () => {
    if (loadingActivities) {
      return (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="40%" height={30} />
                  <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
                  <Skeleton variant="text" width="80%" height={20} sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="70%" height={20} sx={{ mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      );
    }

    if (!activities.length) {
      return (
        <Typography variant="body1" sx={{ textAlign: 'center', mt: 4, color: '#757575' }}>
          No activities recorded yet.
        </Typography>
      );
    }

    return (
      <Grid container spacing={3}>
        {activities.map((activity) => (
          <Grid item xs={12} sm={6} md={4} key={activity.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}
            >
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <Chip 
                    label={activity.activity_type}
                    size="small"
                    sx={{ 
                      backgroundColor: '#FF4081',
                      color: 'white',
                      fontWeight: '500',
                      mb: 1
                    }}
                  />
                  <Typography variant="h6" component="div" sx={{ fontWeight: '500' }}>
                    {activity.activity_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(activity.start_time).toLocaleDateString()} at{' '}
                    {new Date(activity.start_time).toLocaleTimeString()}
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  {activity.duration && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Duration</Typography>
                      <Typography variant="body1">{formatDuration(activity.duration)}</Typography>
                    </Grid>
                  )}
                  {activity.calories && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Calories</Typography>
                      <Typography variant="body1">{Math.round(activity.calories)} kcal</Typography>
                    </Grid>
                  )}
                  {activity.distance != null && activity.distance != 0 && activity.distance != undefined && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Distance</Typography>
                      <Typography variant="body1">{(activity.distance / 1000).toFixed(2)} km</Typography>
                    </Grid>
                  )}
                  {activity.average_hr && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Avg Heart Rate</Typography>
                      <Typography variant="body1">{Math.round(activity.average_hr)} bpm</Typography>
                    </Grid>
                  )}
                  {activity.elevation_gain != null && activity.elevation_gain != 0 && activity.elevation_gain != undefined && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Elevation Gain</Typography>
                      <Typography variant="body1">{Math.round(activity.elevation_gain)}m</Typography>
                    </Grid>
                  )}
                  {(activity.total_sets && activity.total_reps) && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Sets × Reps</Typography>
                      <Typography variant="body1">{activity.total_sets} × {activity.total_reps}</Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        {isNewUser && (
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3,
              backgroundColor: '#E8F4FD',
              '& .MuiAlert-icon': {
                color: '#FF4081'
              }
            }}
          >
            We're collecting your historical Garmin data (last 90 days). This may take a few minutes. You can continue to explore the dashboard while we fetch your data.
          </Alert>
        )}

        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 4,
          borderBottom: '1px solid #E0E0E0',
          paddingBottom: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Logo size={45} />
            <Typography variant="h4" component="h1" sx={{ 
              background: 'linear-gradient(135deg, #FF4081 0%, #424242 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'inline-block',
              mb: 0
            }}>
              Her Garmin
            </Typography>
          </Box>
          <Button
            onClick={handleLogout}
            variant="outlined"
            sx={{
              color: '#FF4081',
              borderColor: '#FF4081',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '500',
              '&:hover': {
                borderColor: '#F50057',
                color: '#F50057',
                backgroundColor: 'rgba(255, 64, 129, 0.04)'
              }
            }}
          >
            Logout
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Heart Rate Chart */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3, height: 400, backgroundColor: '#FAFAFA' }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: '#424242',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 2
              }}>
                Heart Rate Over Time
              </Typography>
              {renderHRChart()}
            </Paper>
          </Grid>

          {/* Cycle Circle */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#FAFAFA' }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: '#424242',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 2
              }}>
                Menstrual Cycle
              </Typography>
              {renderCycleCircle()}
            </Paper>
          </Grid>

          {/* Current Phase Info */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, backgroundColor: '#FAFAFA' }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: '#424242',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                mb: 2
              }}>
                Current Phase
              </Typography>
              {renderCurrentPhase()}
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <AlgorithmVisualization />
          </Grid>
        </Grid>

        <Grid item xs={12} sx={{ mt: 3 }}>
          <Paper 
            elevation={3}
            sx={{
              p: 3,
              backgroundColor: '#FAFAFA',
              borderRadius: 2
            }}
          >
            <Typography 
              variant="h5" 
              component="h2" 
              sx={{ 
                mb: 3,
                fontWeight: '500',
                color: '#424242'
              }}
            >
              Recent Activities
            </Typography>
            {renderActivities()}
          </Paper>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard; 