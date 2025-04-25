from garminconnect import Garmin
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import sys
from dateutil.relativedelta import relativedelta
import numpy as np

# Load environment variables
load_dotenv()

# Initialize Supabase client with service key
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_KEY')
)

def get_menstrual_data(garmin_email, garmin_password, user_id):
    """
    Fetch menstrual data from Garmin Connect for the specified user.
    
    Parameters:
    - garmin_email: Email for Garmin Connect login.
    - garmin_password: Password for Garmin Connect login.
    - user_id: UUID of the user.
    
    Returns:
    - menstrual_data: Dictionary containing menstrual cycle data.
    """
    try:
        # Initialize Garmin client with provided credentials
        garmin = Garmin(garmin_email, garmin_password)
        
        # Login to Garmin Connect
        garmin.login()
        
        # Get menstrual data for the last 3 months
        end_date = datetime.now()
        start_date = end_date - relativedelta(months=3)
        menstrual_data = garmin.get_menstrual_calendar_data(
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        
        if not menstrual_data:
            print(f"No menstrual data found for user {user_id} between {start_date.strftime('%Y-%m-%d')} and {end_date.strftime('%Y-%m-%d')}.")
            return None
        
        print("MENSTRUAL DATA", menstrual_data)
        return menstrual_data
        
    except Exception as e:
        print(f"Error collecting menstrual data: {str(e)}")
        raise e

def predict_menstrual_phases(user_id, supabase, menstrual_data, default_cycle_length=28):
    """
    Predict the menstrual phase for all days in the hr_data table for a user
    using actual menstrual data, and store the predictions in the menstrual_phases table.
    Phases are predicted in the correct order: Menstrual → Follicular → Ovulatory → Luteal.
    
    Parameters:
    - user_id: UUID of the user.
    - supabase: Supabase client instance.
    - menstrual_data: Dictionary containing actual menstrual cycle data.
    - default_cycle_length: Default cycle length in days if not enough data (default: 28).
    """
    try:
        # Retrieve all HR data dates for the user (we only need dates to map predictions)
        response = supabase.table('hr_data')\
            .select('date')\
            .eq('user_id', user_id)\
            .order('date', desc=False)\
            .execute()
        
        if not response.data:
            print(f"No HR data found for user {user_id}. Skipping menstrual phase prediction.")
            return
        
        # Extract dates
        dates = [row['date'] for row in response.data]
        dates = [datetime.strptime(d, '%Y-%m-%d') for d in dates]
        
        # Step 1: Extract cycle start dates from menstrual data
        if not menstrual_data:
            print(f"No menstrual data provided for user {user_id}. Cannot predict phases.")
            return
        
        cycle_summaries = menstrual_data.get('cycleSummaries', [])
        if not cycle_summaries:
            print(f"No cycle summaries found in menstrual data for user {user_id}. Cannot predict phases.")
            return
        
        # Parse cycle start dates and period lengths
        cycle_starts = []
        period_lengths = {}
        fertile_windows = {}
        for cycle in cycle_summaries:
            start_date_str = cycle.get('startDate')
            period_length = cycle.get('periodLength')
            fertile_window_start = cycle.get('fertileWindowStart')
            fertile_window_length = cycle.get('lengthOfFertileWindow')
            
            if not start_date_str or period_length is None:
                continue
            
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            cycle_starts.append(start_date)
            period_lengths[start_date] = period_length
            if fertile_window_start and fertile_window_length:
                fertile_windows[start_date] = (fertile_window_start, fertile_window_length)
        
        if not cycle_starts:
            print(f"No valid cycle starts found in menstrual data for user {user_id}. Cannot predict phases.")
            return
        
        # Sort cycle starts
        cycle_starts.sort()
        
        # Step 2: Filter overlapping cycle starts (keep the most recent in overlapping pairs)
        min_cycle_length = 15 
        filtered_cycle_starts = [cycle_starts[0]]
        for i in range(1, len(cycle_starts)):
            days_since_last_start = (cycle_starts[i] - filtered_cycle_starts[-1]).days
            if days_since_last_start >= min_cycle_length:
                filtered_cycle_starts.append(cycle_starts[i])
            else:
                # Replace the last start date if the new one is more recent
                filtered_cycle_starts[-1] = cycle_starts[i]
                print(f"Replaced cycle start {cycle_starts[i-1].strftime('%Y-%m-%d')} with {cycle_starts[i].strftime('%Y-%m-%d')} (only {days_since_last_start} days apart)")
        
        cycle_starts = filtered_cycle_starts
        print(f"Filtered cycle starts for user {user_id}: {[d.strftime('%Y-%m-%d') for d in cycle_starts]}")
        
        # Step 3: Estimate cycle lengths
        cycle_lengths = []
        for i in range(len(cycle_starts) - 1):
            cycle_length = (cycle_starts[i+1] - cycle_starts[i]).days
            if 15 <= cycle_length <= 45:  # Expanded range to include irregular cycles
                cycle_lengths.append(cycle_length)
        if cycle_lengths:
            estimated_cycle_length = int(np.mean(cycle_lengths))
            print(f"Estimated cycle length for user {user_id}: {estimated_cycle_length} days")
        else:
            estimated_cycle_length = default_cycle_length
            print(f"Using default cycle length for user {user_id}: {estimated_cycle_length} days")
        
        # Step 4: Map cycle starts to indices in the dates list
        cycle_start_indices = []
        for start_date in cycle_starts:
            for i, date in enumerate(dates):
                if date >= start_date:
                    cycle_start_indices.append(i)
                    break
        if not cycle_start_indices:
            print(f"No cycle starts match the date range. Cannot predict phases.")
            return
        
        print(f"Cycle start indices: {cycle_start_indices}")
        
        # Step 5: Assign cycle days and phases
        predictions = []
        for i, date in enumerate(dates):
            # Find the most recent cycle start before the current date
            cycle_start = None
            cycle_start_idx = None
            for idx, start_date in zip(cycle_start_indices, cycle_starts):
                if date >= start_date:
                    cycle_start = start_date
                    cycle_start_idx = idx
                else:
                    break
            
            if not cycle_start:
                # If the date is before the first cycle start, project backward
                cycle_start = cycle_starts[0]
                days_before_first = (cycle_starts[0] - date).days
                cycles_before = (days_before_first // estimated_cycle_length) + 1
                cycle_start = cycle_starts[0] - timedelta(days=cycles_before * estimated_cycle_length)
                cycle_start_idx = 0
            
            # Calculate cycle day
            cycle_day = (date - cycle_start).days + 1
            
            # Determine the cycle length for this cycle
            next_cycle_idx = cycle_start_indices.index(cycle_start_idx) + 1 if cycle_start_idx in cycle_start_indices else -1
            if next_cycle_idx < len(cycle_start_indices):
                current_cycle_length = (dates[cycle_start_indices[next_cycle_idx]] - cycle_start).days
            else:
                current_cycle_length = estimated_cycle_length
            
            # Define phase durations
            # Menstrual: Use the actual period length
            menstrual_duration = period_lengths.get(cycle_start, 5)  # Default to 5 if not found
            
            # Ovulatory: Use fertile window if available, otherwise estimate
            if cycle_start in fertile_windows:
                ovulatory_start = fertile_windows[cycle_start][0]
                ovulatory_duration = fertile_windows[cycle_start][1]
            else:
                # Estimate ovulation as the midpoint of a typical fertile window (days 10-16 for a 28-day cycle)
                ovulatory_midpoint = int(current_cycle_length * 14 / 28)  # Scale based on cycle length
                ovulatory_start = max(menstrual_duration + 1, ovulatory_midpoint - 3)
                ovulatory_duration = 7  # Typical fertile window length
                if ovulatory_start + ovulatory_duration - 1 > current_cycle_length:
                    ovulatory_start = max(menstrual_duration + 1, current_cycle_length - ovulatory_duration + 1)
            
            # Luteal: Estimate as the remaining days, typically 10-16 days
            luteal_duration = current_cycle_length - (ovulatory_start + ovulatory_duration - 1)
            luteal_duration = max(10, min(16, luteal_duration))  # Constrain to 10-16 days
            ovulatory_start = max(menstrual_duration + 1, current_cycle_length - luteal_duration - ovulatory_duration + 1)
            
            # Follicular: Fills the gap between Menstrual and Ovulatory
            follicular_duration = ovulatory_start - menstrual_duration - 1
            if follicular_duration < 1:
                follicular_duration = 1
                ovulatory_start = menstrual_duration + follicular_duration + 1
            
            # Define phase day ranges
            menstrual_end = menstrual_duration
            follicular_end = menstrual_end + follicular_duration
            ovulatory_end = follicular_end + ovulatory_duration
            luteal_end = current_cycle_length  # Luteal phase extends to the end of the cycle
            
            # Map cycle_day to the correct phase
            cycle_day_within_phase = cycle_day % current_cycle_length if cycle_day % current_cycle_length != 0 else current_cycle_length
            if 1 <= cycle_day_within_phase <= menstrual_end:
                predicted_phase = "Menstrual"
            elif menstrual_end < cycle_day_within_phase <= follicular_end:
                predicted_phase = "Follicular"
            elif follicular_end < cycle_day_within_phase <= ovulatory_end:
                predicted_phase = "Ovulatory"
            else:
                predicted_phase = "Luteal"
            
            predictions.append({
                'user_id': user_id,
                'date': date.strftime('%Y-%m-%d'),
                'start_date': cycle_start.strftime('%Y-%m-%d'),
                'predicted_phase': predicted_phase,
                'cycle_day': cycle_day_within_phase
            })
        
        # Step 6: Store predictions in the menstrual_phases table
        for prediction in predictions:
            try:
                existing = supabase.table('menstrual_phases')\
                    .select('id')\
                    .eq('user_id', prediction['user_id'])\
                    .eq('date', prediction['date'])\
                    .execute()
                
                if existing.data:
                    response = supabase.table('menstrual_phases')\
                        .update({
                            'start_date': prediction['start_date'],
                            'predicted_phase': prediction['predicted_phase'],
                            'cycle_day': prediction['cycle_day']
                        })\
                        .eq('user_id', prediction['user_id'])\
                        .eq('date', prediction['date'])\
                        .execute()
                    print(f"Updated menstrual phase prediction for {prediction['date']}: {prediction['predicted_phase']} (Cycle Day: {prediction['cycle_day']})")
                else:
                    response = supabase.table('menstrual_phases')\
                        .insert(prediction)\
                        .execute()
                    print(f"Inserted menstrual phase prediction for {prediction['date']}: {prediction['predicted_phase']} (Cycle Day: {prediction['cycle_day']})")
            except Exception as e:
                print(f"Error storing prediction for {prediction['date']}: {str(e)}")
                raise e
        
        print(f"Predicted menstrual phases for {len(predictions)} days for user {user_id}")
        
    except Exception as e:
        print(f"Error predicting menstrual phases for user {user_id}: {str(e)}")
        raise e

def get_sleep_data(garmin_email, garmin_password, user_id):
    """
    Fetch sleep data from Garmin Connect for the specified user, including respiration metrics,
    and store it in Supabase.
    
    Parameters:
    - garmin_email: Email for Garmin Connect login.
    - garmin_password: Password for Garmin Connect login.
    - user_id: UUID of the user.
    """
    try:
        # Initialize Garmin client with provided credentials
        garmin = Garmin(garmin_email, garmin_password)
        
        # Login to Garmin Connect
        garmin.login()
        
        # Get sleep data for the last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        date_list = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]
        
        # Process sleep data for each day
        for current_date in date_list:
            date_str = current_date.strftime('%Y-%m-%d')
            try:
                # Fetch sleep data for the specific day
                sleep_data = garmin.get_sleep_data(date_str)
                
                if not sleep_data or 'dailySleepDTO' not in sleep_data:
                    print(f"No sleep data found for {date_str}")
                    continue
                
                daily_sleep = sleep_data['dailySleepDTO']
                
                # Extract respiration metrics from wellnessEpochRespirationAveragesList
                respiration_averages = sleep_data.get('wellnessEpochRespirationAveragesList', [])
                avg_respiration = None
                high_respiration = None
                low_respiration = None
                
                if respiration_averages:
                    # Filter out entries with negative or invalid respiration averages
                    valid_averages = [
                        entry['respirationAverageValue']
                        for entry in respiration_averages
                        if entry['respirationAverageValue'] is not None and entry['respirationAverageValue'] > 0
                    ]
                    valid_highs = [
                        entry['respirationHighValue']
                        for entry in respiration_averages
                        if entry['respirationHighValue'] is not None and entry['respirationHighValue'] > 0
                    ]
                    valid_lows = [
                        entry['respirationLowValue']
                        for entry in respiration_averages
                        if entry['respirationLowValue'] is not None and entry['respirationLowValue'] > 0
                    ]
                    
                    # Calculate overall average, high, and low respiration rates
                    if valid_averages:
                        avg_respiration = sum(valid_averages) / len(valid_averages)
                    if valid_highs:
                        high_respiration = max(valid_highs)
                    if valid_lows:
                        low_respiration = min(valid_lows)
                
                # Extract sleep metrics
                sleep_entry = {
                    'user_id': user_id,
                    'date': date_str,
                    'start_time': daily_sleep.get('sleepStartTimestampLocal', None),
                    'end_time': daily_sleep.get('sleepEndTimestampLocal', None),
                    'duration': daily_sleep.get('sleepTimeSeconds', 0),
                    'rem_sleep': daily_sleep.get('remSleepSeconds', 0),
                    'deep_sleep': daily_sleep.get('deepSleepSeconds', 0),
                    'light_sleep': daily_sleep.get('lightSleepSeconds', 0),
                    'awake_time': daily_sleep.get('awakeTimeSeconds', 0),
                    'sleep_quality': daily_sleep.get('sleepQualityType', None),
                    'avg_respiration': avg_respiration,
                    'high_respiration': high_respiration,
                    'low_respiration': low_respiration,
                    'avg_overnight_hrv': sleep_data.get('avgOvernightHrv', None),
                    'resting_heart_rate': sleep_data.get('restingHeartRate', None),
                }
                
                # Check if a row with the same (user_id, date) exists
                existing = supabase.table('sleep_data')\
                    .select('id')\
                    .eq('user_id', user_id)\
                    .eq('date', date_str)\
                    .execute()
                
                if existing.data:
                    # Update the existing row
                    response = supabase.table('sleep_data')\
                        .update(sleep_entry)\
                        .eq('user_id', user_id)\
                        .eq('date', date_str)\
                        .execute()
                    print(f"Updated sleep data for {date_str}")
                else:
                    # Insert a new row
                    response = supabase.table('sleep_data')\
                        .insert(sleep_entry)\
                        .execute()
                    print(f"Inserted sleep data for {date_str}")
                
            except Exception as e:
                print(f"Error processing sleep data for {date_str}: {str(e)}")
                continue  # Continue to the next date instead of raising an error
                
    except Exception as e:
        print(f"Error collecting sleep data: {str(e)}")
        raise e

def get_activities(garmin_email, garmin_password, user_id):
    """
    Fetch activities from Garmin Connect for the specified user and store them in Supabase.
    """
    try:
        # Initialize Garmin client with provided credentials
        garmin = Garmin(garmin_email, garmin_password)
        
        # Login to Garmin Connect
        garmin.login()
        
        # Get activities for the last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)
        activities = garmin.get_activities_by_date(
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        
        # Process each activity and insert into Supabase
        for activity in activities:
            activity_data = {
                'user_id': user_id,
                'activityid': activity['activityId'],               
                'activity_name': activity['activityName'],
                'activity_type': activity['activityType']['typeKey'],
                'start_time': activity['startTimeLocal'],
                'duration': activity['duration'],
                'calories': activity.get('calories', 0.0),
                'average_hr': activity.get('averageHR', None),
                'max_hr': activity.get('maxHR', None),
                'distance': activity.get('distance', None),
                'average_speed': activity.get('averageSpeed', None),
                'elevation_gain': activity.get('elevationGain', None),
                'elevation_loss': activity.get('elevationLoss', None),
                'total_sets': activity.get('totalSets', None),
                'total_reps': activity.get('totalReps', None),
            }
            
            try:
                # Check if a row with the same (user_id, start_time) exists
                existing = supabase.table('activities')\
                    .select('id')\
                    .eq('user_id', user_id)\
                    .eq('start_time', activity['startTimeLocal'])\
                    .execute()
                
                if existing.data:
                    # Update the existing row
                    response = supabase.table('activities')\
                        .update(activity_data)\
                        .eq('user_id', user_id)\
                        .eq('start_time', activity['startTimeLocal'])\
                        .execute()
                    print(f"Updated activity for {activity['startTimeLocal']}")
                else:
                    # Insert a new row
                    response = supabase.table('activities')\
                        .insert(activity_data)\
                        .execute()
                    print(f"Inserted activity for {activity['startTimeLocal']}")
                
            except Exception as e:
                print(f"Error processing activity for {activity['startTimeLocal']}: {str(e)}")
                raise e
                
    except Exception as e:
        print(f"Error collecting data: {str(e)}")
        raise e

def get_hr_data(garmin_email, garmin_password, user_id):
    """
    Fetch HRV and RHR data from Garmin Connect for the specified user and store it in Supabase.
    """
    try:
        # Initialize Garmin client with provided credentials
        garmin = Garmin(garmin_email, garmin_password)
        
        # Login to Garmin Connect
        garmin.login()
        
        # Calculate date range (three months previous to current date)
        end_date = datetime.now()  # Current date
        start_date = end_date - relativedelta(months=3)  # Three months previous
        print(f"Fetching HR data from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        
        # Generate list of dates
        delta = end_date - start_date
        date_list = [start_date + timedelta(days=x) for x in range(delta.days + 1)]
        
        # Collect HRV and RHR data together
        hr_data = []

        for current in date_list:
            current_date_str = current.strftime('%Y-%m-%d')
            entry = {
                'date': current_date_str,
                'user_id': user_id,
                'hrv_status': None,
                'rhr': None
            }
            
            # Get HRV data
            try:
                hrv_status = garmin.get_hrv_data(current_date_str)
                if hrv_status and 'hrvReadings' in hrv_status and hrv_status['hrvReadings']:
                    hrv_values = [reading['hrvValue'] for reading in hrv_status['hrvReadings'] if reading['hrvValue'] is not None]
                    if hrv_values:
                        avg_hrv = sum(hrv_values) / len(hrv_values)
                        entry['hrv_status'] = avg_hrv
                        print(f"HRV average for {current_date_str}: {avg_hrv}")
                    else:
                        print(f"No valid HRV values for {current_date_str}")
                else:
                    print(f"No HRV readings for {current_date_str}")
            except Exception as e:
                print(f"Error getting HRV data for {current_date_str}: {str(e)}")

            # Get RHR data
            try:
                rhr_response = garmin.get_rhr_day(current_date_str)
                print(f"RHR response for {current_date_str}: {rhr_response}")
                if (rhr_response and 
                    'allMetrics' in rhr_response and 
                    rhr_response['allMetrics'] and 
                    'metricsMap' in rhr_response['allMetrics'] and 
                    'WELLNESS_RESTING_HEART_RATE' in rhr_response['allMetrics']['metricsMap'] and 
                    rhr_response['allMetrics']['metricsMap']['WELLNESS_RESTING_HEART_RATE']):
                    rhr_data = rhr_response['allMetrics']['metricsMap']['WELLNESS_RESTING_HEART_RATE']
                    if rhr_data and len(rhr_data) > 0 and 'value' in rhr_data[0] and rhr_data[0]['value'] is not None:
                        entry['rhr'] = rhr_data[0]['value']
                        print(f"RHR set to {entry['rhr']} for {current_date_str}")
                    else:
                        print(f"No valid RHR value in response for {current_date_str}")
                else:
                    print(f"No RHR data in response for {current_date_str}")
            except Exception as e:
                print(f"Error getting RHR for {current_date_str}: {str(e)}")
            
            # Only add the entry if both HRV and RHR are available
            if entry['hrv_status'] is not None and entry['rhr'] is not None:
                hr_data.append(entry)
                print(f"Collected HR data for {current_date_str}: HRV={entry['hrv_status']}, RHR={entry['rhr']}")
        
        # Store combined HR data in Supabase
        if hr_data:
            try:
                # Manually check for existing rows and update or insert
                for entry in hr_data:
                    # Check if a row with the same (user_id, date) exists
                    existing = supabase.table('hr_data')\
                        .select('id')\
                        .eq('user_id', entry['user_id'])\
                        .eq('date', entry['date'])\
                        .execute()
                    
                    if existing.data:
                        # Update the existing row
                        response = supabase.table('hr_data')\
                            .update({
                                'hrv_status': entry['hrv_status'],
                                'rhr': entry['rhr']
                            })\
                            .eq('user_id', entry['user_id'])\
                            .eq('date', entry['date'])\
                            .execute()
                        print(f"Updated HR data for {entry['date']}")
                    else:
                        # Insert a new row
                        response = supabase.table('hr_data')\
                            .insert(entry)\
                            .execute()
                        print(f"Inserted HR data for {entry['date']}")
                
                print(f"Processed {len(hr_data)} days of HR data")
            except Exception as e:
                print(f"Error storing HR data: {str(e)}")
                raise e
        else:
            print("No HR data (both HRV and RHR) retrieved for the date range.")

        # For debugging: Print the user's full name
        name = garmin.get_full_name()
        print(f"User: {name}, HR data processed: {len(hr_data)} days")
        
        # Fetch menstrual data and predict menstrual phases
        if hr_data:
            menstrual_data = get_menstrual_data(garmin_email, garmin_password, user_id)
            if menstrual_data:
                predict_menstrual_phases(user_id, supabase, menstrual_data)
                
    except Exception as e:
        print(f"Error collecting data: {str(e)}")
        raise e

def test(garmin_email, garmin_password, user_id):
    """
    Test function to fetch and print menstrual data, then predict phases.
    """
    garmin = Garmin(garmin_email, garmin_password)
    garmin.login()
    end_date = datetime.now()
    start_date = end_date - relativedelta(months=3)
    test_data = garmin.get_activities_by_date(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
    print(test_data)

def calculate_current_phase(menstrual_data, current_date_str='2025-04-10'):
    """
    Calculate the menstrual phase for the current date based on the last period start date.
    
    Parameters:
    - menstrual_data: Dictionary containing menstrual cycle data.
    - current_date_str: The date to calculate the phase for (default: '2025-04-10').
    
    Returns:
    - dict: Information about the current phase, cycle day, and start date.
    """
    try:
        current_date = datetime.strptime(current_date_str, '%Y-%m-%d')
        
        # Extract cycle summaries
        cycle_summaries = menstrual_data.get('cycleSummaries', [])
        if not cycle_summaries:
            return {"error": "No cycle summaries found in menstrual data."}
        
        # Parse cycle start dates
        cycle_starts = []
        period_lengths = {}
        fertile_windows = {}
        for cycle in cycle_summaries:
            start_date_str = cycle.get('startDate')
            period_length = cycle.get('periodLength')
            fertile_window_start = cycle.get('fertileWindowStart')
            fertile_window_length = cycle.get('lengthOfFertileWindow')
            if not start_date_str or period_length is None:
                continue
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            cycle_starts.append(start_date)
            period_lengths[start_date] = period_length
            if fertile_window_start and fertile_window_length:
                fertile_windows[start_date] = (fertile_window_start, fertile_window_length)
        
        if not cycle_starts:
            return {"error": "No valid cycle starts found in menstrual data."}
        
        # Sort cycle starts and filter overlapping starts
        cycle_starts.sort()
        min_cycle_length = 15
        filtered_cycle_starts = [cycle_starts[0]]
        for i in range(1, len(cycle_starts)):
            days_since_last_start = (cycle_starts[i] - filtered_cycle_starts[-1]).days
            if days_since_last_start >= min_cycle_length:
                filtered_cycle_starts.append(cycle_starts[i])
            else:
                filtered_cycle_starts[-1] = cycle_starts[i]
        
        cycle_starts = filtered_cycle_starts
        
        # Find the most recent cycle start before the current date
        last_cycle_start = None
        for start_date in reversed(cycle_starts):
            if start_date <= current_date:
                last_cycle_start = start_date
                break
        
        if not last_cycle_start:
            return {"error": "No cycle start found before the current date."}
        
        # Calculate cycle day
        cycle_day = (current_date - last_cycle_start).days + 1
        
        # Estimate cycle length based on historical data
        cycle_lengths = []
        for i in range(len(cycle_starts) - 1):
            cycle_length = (cycle_starts[i+1] - cycle_starts[i]).days
            if 15 <= cycle_length <= 45:
                cycle_lengths.append(cycle_length)
        estimated_cycle_length = int(np.mean(cycle_lengths)) if cycle_lengths else 28
        
        # Define phase durations
        menstrual_duration = period_lengths.get(last_cycle_start, 5)
        
        # Ovulatory: Use fertile window if available, otherwise estimate
        if last_cycle_start in fertile_windows:
            ovulatory_start = fertile_windows[last_cycle_start][0]
            ovulatory_duration = fertile_windows[last_cycle_start][1]
        else:
            ovulatory_midpoint = int(estimated_cycle_length * 14 / 28)
            ovulatory_start = max(menstrual_duration + 1, ovulatory_midpoint - 3)
            ovulatory_duration = 7
            if ovulatory_start + ovulatory_duration - 1 > estimated_cycle_length:
                ovulatory_start = max(menstrual_duration + 1, estimated_cycle_length - ovulatory_duration + 1)
        
        # Luteal: Estimate as the remaining days, typically 10-16 days
        luteal_duration = estimated_cycle_length - (ovulatory_start + ovulatory_duration - 1)
        luteal_duration = max(10, min(16, luteal_duration))
        ovulatory_start = max(menstrual_duration + 1, estimated_cycle_length - luteal_duration - ovulatory_duration + 1)
        
        # Follicular: Fills the gap between Menstrual and Ovulatory
        follicular_duration = ovulatory_start - menstrual_duration - 1
        if follicular_duration < 1:
            follicular_duration = 1
            ovulatory_start = menstrual_duration + follicular_duration + 1
        
        # Define phase day ranges
        menstrual_end = menstrual_duration
        follicular_end = menstrual_end + follicular_duration
        ovulatory_end = follicular_end + ovulatory_duration
        luteal_end = estimated_cycle_length
        
        # Map cycle_day to the correct phase
        cycle_day_within_phase = cycle_day % estimated_cycle_length if cycle_day % estimated_cycle_length != 0 else estimated_cycle_length
        if 1 <= cycle_day_within_phase <= menstrual_end:
            predicted_phase = "Menstrual"
        elif menstrual_end < cycle_day_within_phase <= follicular_end:
            predicted_phase = "Follicular"
        elif follicular_end < cycle_day_within_phase <= ovulatory_end:
            predicted_phase = "Ovulatory"
        else:
            predicted_phase = "Luteal"
        
        return {
            "date": current_date_str,
            "start_date": last_cycle_start.strftime('%Y-%m-%d'),
            "predicted_phase": predicted_phase,
            "cycle_day": cycle_day_within_phase,
            "estimated_cycle_length": estimated_cycle_length
        }
        
    except Exception as e:
        return {"error": f"Error calculating current phase: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python garmin_data_collector.py <garmin_email> <garmin_password> <user_id>")
        sys.exit(1)
    
    garmin_email = sys.argv[1]
    garmin_password = sys.argv[2]
    user_id = sys.argv[3]
    
    # Fetch activities
    get_activities(garmin_email, garmin_password, user_id)
    
    # Fetch HR data and predict menstrual phases
    get_hr_data(garmin_email, garmin_password, user_id)

    
    # get_sleep_data(garmin_email, garmin_password, user_id)
    # # Test menstrual data fetching and predict phases
    # test(garmin_email, garmin_password, user_id)
    
    # Calculate the current phase for April 10, 2025
    # menstrual_data = get_menstrual_data(garmin_email, garmin_password, user_id)
    # if menstrual_data:
    #     current_phase = calculate_current_phase(menstrual_data, '2025-04-10')
    #     print("Current Phase on 2025-04-10:", current_phase)
    
    print("DONE")