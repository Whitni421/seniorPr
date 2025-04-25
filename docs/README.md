source venv/bin/activate

Available methods in garmin_client:
- ActivityDownloadFormat
- ActivityUploadFormat
- add_body_composition
- add_hydration_data
- add_weigh_in
- add_weigh_in_with_timestamps
- connectapi
- create_manual_activity
- create_manual_activity_from_json
- delete_activity
- delete_blood_pressure
- delete_weigh_in
- delete_weigh_ins
- display_name
- download
- download_activity
- download_workout
- full_name
- garmin_all_day_stress_url
- garmin_connect_activities
- garmin_connect_activities_baseurl
- garmin_connect_activity
- garmin_connect_activity_fordate
- garmin_connect_activity_types
- garmin_connect_adhoc_challenge_url
- garmin_connect_adhoc_challenges_url
- garmin_connect_available_badge_challenges_url
- garmin_connect_badge_challenges_url
- garmin_connect_blood_pressure_endpoint
- garmin_connect_body_battery_events_url
- garmin_connect_csv_download
- garmin_connect_daily_body_battery_url
- garmin_connect_daily_hydration_url
- garmin_connect_daily_intensity_minutes
- garmin_connect_daily_respiration_url
- garmin_connect_daily_sleep_url
- garmin_connect_daily_spo2_url
- garmin_connect_daily_stats_steps_url
- garmin_connect_daily_stress_url
- garmin_connect_daily_summary_url
- garmin_connect_delete_activity_url
- garmin_connect_device_url
- garmin_connect_devices_url
- garmin_connect_earned_badges_url
- garmin_connect_endurance_score_url
- garmin_connect_fit_download
- garmin_connect_fitnessage
- garmin_connect_fitnessstats
- garmin_connect_floors_chart_daily_url
- garmin_connect_gear
- garmin_connect_gear_baseurl
- garmin_connect_goals_url
- garmin_connect_gpx_download
- garmin_connect_heartrates_daily_url
- garmin_connect_hill_score_url
- garmin_connect_hrv_url
- garmin_connect_inprogress_virtual_challenges_url';
- garmin_connect_kml_download
- garmin_connect_menstrual_calendar_url
- garmin_connect_menstrual_dayview_url
- garmin_connect_metrics_url
- garmin_connect_non_completed_badge_challenges_url
- garmin_connect_personal_record_url
- garmin_connect_pregnancy_snapshot_url
- garmin_connect_primary_device_url
- garmin_connect_race_predictor_url
- garmin_connect_rhr_url
- garmin_connect_set_blood_pressure_endpoint
- garmin_connect_set_hydration_url
- garmin_connect_solar_url
- garmin_connect_tcx_download
- garmin_connect_training_readiness_url
- garmin_connect_training_status_url
- garmin_connect_upload
- garmin_connect_user_settings_url
- garmin_connect_user_summary_chart
- garmin_connect_userprofile_settings_url
- garmin_connect_weight_url
- garmin_daily_events_url
- garmin_graphql_endpoint
- garmin_request_reload_url
- garmin_workouts
- garth
- get_activities
- get_activities_by_date
- get_activities_fordate
- get_activity
- get_activity_details
- get_activity_exercise_sets
- get_activity_gear
- get_activity_hr_in_timezones
- get_activity_split_summaries
- get_activity_splits
- get_activity_typed_splits
- get_activity_types
- get_activity_weather
- get_adhoc_challenges
- get_all_day_events
- get_all_day_stress
- get_available_badge_challenges
- get_badge_challenges
- get_blood_pressure
- get_body_battery
- get_body_battery_events
- get_body_composition
- get_daily_steps
- get_daily_weigh_ins
- get_device_alarms
- get_device_last_used
- get_device_settings
- get_device_solar_data
- get_devices
- get_earned_badges
- get_endurance_score
- get_fitnessage_data
- get_floors
- get_full_name
- get_gear
- get_gear_ativities
- get_gear_defaults
- get_gear_stats
- get_goals
- get_heart_rates
- get_hill_score
- get_hrv_data
- get_hydration_data
- get_inprogress_virtual_challenges
- get_intensity_minutes_data
- get_last_activity
- get_max_metrics
- get_menstrual_calendar_data
- get_menstrual_data_for_date
- get_non_completed_badge_challenges
- get_personal_record
- get_pregnancy_summary
- get_primary_training_device
- get_progress_summary_between_dates
- get_race_predictions
- get_respiration_data
- get_rhr_day
- get_sleep_data
- get_spo2_data
- get_stats
- get_stats_and_body
- get_steps_data
- get_stress_data
- get_training_readiness
- get_training_status
- get_unit_system
- get_user_profile
- get_user_summary
- get_userprofile_settings
- get_weigh_ins
- get_workout_by_id
- get_workouts
- is_cn
- login
- logout
- password
- prompt_mfa
- query_garmin_graphql
- request_reload
- set_activity_name
- set_activity_type
- set_blood_pressure
- set_gear_default
- unit_system
- upload_activity
- username


# Cycle Tracking Web App

A web application that tracks cycling activities using Garmin Connect data, stored in Supabase.

## Project Structure

- `server.js` - Node.js backend server
- `garmin_data_collector.py` - Python script for collecting Garmin Connect data
- `client/` - React frontend (to be created)
- `.env` - Environment variables (create from .env.example)

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   pip install garminconnect python-dotenv supabase
   ```

3. Create a `.env` file based on `.env.example` and fill in your credentials:
   - Garmin Connect email and password
   - Supabase URL and API key
   - User ID

4. Set up Supabase:
   - Create a new project in Supabase
   - Create a table called `cycling_activities` with the following columns:
     - activity_id (text, primary key)
     - start_time (timestamp)
     - duration (integer)
     - distance (float)
     - calories (integer)
     - average_speed (float)
     - max_speed (float)
     - elevation_gain (float)
     - average_heart_rate (integer)
     - max_heart_rate (integer)
     - user_id (text)

## Running the Application

1. Start the backend server:
   ```bash
   npm run dev
   ```

2. Run the Garmin data collector (when needed):
   ```bash
   python garmin_data_collector.py
   ```

3. The React frontend will be created separately (instructions to follow)

## API Endpoints

- `GET /api/activities/:userId` - Get all cycling activities for a user
- `GET /api/stats/:userId` - Get cycling statistics for a user

## Security Notes

- Never commit your `.env` file
- Keep your Garmin Connect credentials secure
- Use environment variables for all sensitive data 