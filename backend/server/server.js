require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Handle static files with WSL compatibility
const isWSL = os.release().toLowerCase().includes('microsoft');
const staticPath = isWSL 
  ? path.resolve(__dirname, '../../frontend/dist')
  : path.join(__dirname, '../../frontend/dist');
app.use(express.static(staticPath));

// Debug: Print environment variables to confirm they are loaded
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY);
console.log('Running in WSL:', isWSL);

// Initialize Supabase client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables. Check .env file.');
}
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Create tables if they don't exist
const createTables = async () => {
  try {
    // Create activities table
    const { data: activitiesExists } = await supabase
      .from('activities')
      .select('id')
      .limit(1);

    if (!activitiesExists) {
      const { error: activitiesError } = await supabase
        .rpc('create_activities_table', {
          sql: `
            CREATE TABLE IF NOT EXISTS activities (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              user_id UUID REFERENCES users(id),
              activity_name TEXT NOT NULL,
              activity_type TEXT NOT NULL,
              start_time TIMESTAMP WITH TIME ZONE NOT NULL,
              duration INTEGER,
              calories FLOAT,
              average_hr FLOAT,
              max_hr FLOAT,
              distance FLOAT,
              average_speed FLOAT,
              elevation_gain FLOAT,
              elevation_loss FLOAT,
              total_sets INTEGER,
              total_reps INTEGER,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
          `
        });

      if (activitiesError) {
        console.error('Error creating activities table:', activitiesError);
      }
    }

    // Create hr_data table
    const { data: hrDataExists } = await supabase
      .from('hr_data')
      .select('id')
      .limit(1);

    if (!hrDataExists) {
      const { error: hrDataError } = await supabase
        .rpc('create_hr_data_table', {
          sql: `
            CREATE TABLE IF NOT EXISTS hr_data (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              user_id UUID REFERENCES users(id),
              date DATE NOT NULL,
              hrv_status FLOAT,
              rhr INTEGER,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, date)
            );
          `
        });

      if (hrDataError) {
        console.error('Error creating hr_data table:', hrDataError);
      }
    }

    // Create menstrual_phases table
    const { data: phasesExists } = await supabase
      .from('menstrual_phases')
      .select('id')
      .limit(1);

    if (!phasesExists) {
      const { error: phasesError } = await supabase
        .rpc('create_menstrual_phases_table', {
          sql: `
            CREATE TABLE IF NOT EXISTS menstrual_phases (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              user_id UUID REFERENCES users(id),
              cycle_day INTEGER NOT NULL,
              predicted_phase TEXT NOT NULL,
              start_date DATE NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, start_date)
            );
          `
        });

      if (phasesError) {
        console.error('Error creating menstrual_phases table:', phasesError);
      }
    }

  } catch (err) {
    console.error('Error creating tables:', err);
  }
};

// Call createTables when server starts
createTables();

// Update Python path handling for WSL compatibility
const getPythonPath = () => {
  if (isWSL) {
    return path.join(__dirname, '..', 'venv', 'bin', 'python3');
  }
  return process.platform === 'win32'
    ? path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe')
    : path.join(__dirname, '..', 'venv', 'bin', 'python3');
};

// Register new user and collect Garmin data
app.post('/api/auth/register', async (req, res) => {
  try {
    const { garminEmail, garminPassword } = req.body;

    if (!garminEmail || !garminPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();

    // Create user in Supabase
    const { data, error } = await supabase
      .from('users')
      .insert([
        { id: id, email: garminEmail, password: garminPassword },
      ])
      .select();

    if (error) throw error;

    // Create a base64 encoded token from the UUID
    const token = Buffer.from(id, 'utf-8').toString('base64');

    // Start the Python script in the background
    const pythonPath = getPythonPath();
    console.log(`Starting data collection with Python executable: ${pythonPath}`);
    
    const pythonProcess = spawn(pythonPath, [
      path.join(__dirname, '..', 'scripts', 'garmin_data_collector.py'),
      garminEmail,
      garminPassword,
      id
    ], { 
      detached: true,
      stdio: 'ignore'
    });

    // Let the process run independently
    pythonProcess.unref();

    console.log('Started Garmin data collection process');

    res.json({ 
      token: token,
      user_id: id,
      message: 'User registered successfully. Historical data collection has started.'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily stats for a user
app.get('/api/daily-stats', async (req, res) => {
  try {
    const { garminEmail, garminPassword, user_id } = req.body; // Reverted to req.body

    if (!garminEmail || !garminPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine the Python executable path based on the platform
    const pythonPath = getPythonPath();

    console.log(`Using Python executable: ${pythonPath}`);

    // Run Python script in the virtual environment
    const pythonProcess = spawn(pythonPath, [
      path.join(__dirname, '..', 'scripts', 'update_values.py'), // Correct path
      garminEmail,
      garminPassword,
      user_id
    ], { shell: true });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python script output: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python script error: ${data}`);
    });

    pythonProcess.on('error', (err) => {
      console.error(`Failed to start Python script: ${err}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
      }
    });

    res.json({ 
      message: 'User has had data updated for today.',
    });

  } catch (error) {
    console.error('update values error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { garminEmail, garminPassword } = req.body;

    if (!garminEmail || !garminPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists in Supabase
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', garminEmail)
      .eq('password', garminPassword)
      .single();

    if (error) {
      console.error('Login error:', error);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!users) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create a base64 encoded token from the UUID
    const token = Buffer.from(users.id, 'utf-8').toString('base64');

    res.json({
      token: token,
      user_id: users.id,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get HR data for a user
app.get('/api/hr_data', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user_id from the request
    const user_id = req.query.user_id;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id parameter' });
    }

    console.log('Fetching HR data for user:', user_id);

    const { data, error } = await supabase
      .from('hr_data')
      .select('*')
      .eq('user_id', user_id)
      .order('date', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching HR data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get menstrual phases for a user
app.get('/api/menstrual_phases', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user_id from the request
    const user_id = req.query.user_id;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id parameter' });
    }

    console.log('Fetching menstrual phases for user:', user_id);

    const { data, error } = await supabase
      .from('menstrual_phases')
      .select('*')
      .eq('user_id', user_id)
      .order('date', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching menstrual phases:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update the authenticateToken middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.error('No token provided in request');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    console.log('Received token:', token);
    // Decode the base64 token to get the user_id
    const user_id = Buffer.from(token, 'base64').toString('utf-8');
    console.log('Decoded user_id:', user_id);
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      console.error('Invalid UUID format:', user_id);
      throw new Error('Invalid token format');
    }

    // Check if user exists in database
    supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Database error:', error);
          return res.status(500).json({ error: 'Server error' });
        }
        if (!data) {
          console.error('User not found for id:', user_id);
          return res.status(403).json({ error: 'Invalid token' });
        }
        console.log('User authenticated successfully:', data.id);
        req.user = { user_id };
        next();
      })
      .catch(err => {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Server error' });
      });

  } catch (err) {
    console.error('Token validation error:', err);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Update the activities endpoint
app.get('/api/activities', authenticateToken, async (req, res) => {
  try {
    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', req.user.user_id)
      .order('start_time', { ascending: false });

    if (error) throw error;
    res.json(activities);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});