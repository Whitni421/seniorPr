from garminconnect import Garmin
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import sys
from garmin_data_collector import predict_menstrual_phases, get_menstrual_data
import logging

# Set up logging
logging.basicConfig(
    filename='daily_update.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_KEY')
)

def update_user_data(email: str, password: str, user_id: str):
    try:
        # Initialize Garmin client
        client = Garmin(email, password)
        client.login()
        
        # Get today's date
        today = datetime.now().date()
        
        # Fetch heart rate data
        try:
            hr_data = client.get_heart_rates(today)
            if isinstance(hr_data, dict):  # Check if hr_data is a dictionary
                rhr = hr_data.get('restingHeartRate', None)
                hrv = hr_data.get('hrvStatus', None)
                
                if rhr or hrv:
                    # Insert into hr_data table
                    supabase.table('hr_data').insert({
                        'user_id': user_id,
                        'date': today.isoformat(),
                        'rhr': rhr,
                        'hrv_status': hrv
                    }).execute()
                    logging.info(f"Updated HR data for user {email}")
            else:
                logging.error(f"Invalid HR data format for user {email}: {hr_data}")
        except Exception as e:
            logging.error(f"Error fetching HR data for user {email}: {str(e)}")
        
        # Fetch menstrual data if available
        try:
            menstrual_data = client.get_menstrual_data(today)
            if menstrual_data and isinstance(menstrual_data, dict):  # Check if menstrual_data is a dictionary
                phase = menstrual_data.get('phase')
                cycle_day = menstrual_data.get('cycleDay')
                
                if phase and cycle_day:
                    supabase.table('menstrual_phases').insert({
                        'user_id': user_id,
                        'date': today.isoformat(),
                        'predicted_phase': phase,
                        'cycle_day': cycle_day
                    }).execute()
                    logging.info(f"Updated menstrual data for user {email}")
            else:
                logging.error(f"Invalid menstrual data format for user {email}: {menstrual_data}")
        except Exception as e:
            logging.error(f"Error fetching menstrual data for user {email}: {str(e)}")
            
        client.logout()
        logging.info(f"Successfully updated all data for user {email}")
        
    except Exception as e:
        logging.error(f"Error updating data for user {email}: {str(e)}")

def main():
    try:
        # Fetch all users from the database
        response = supabase.table('users').select('id, email, password').execute()
        users = response.data
        
        logging.info(f"Found {len(users)} users to update")
        
        # Update data for each user
        for user in users:
            logging.info(f"Starting update for user {user['email']}")
            update_user_data(user['email'], user['password'], user['id'])
            
        logging.info("Daily update completed successfully")
        
    except Exception as e:
        logging.error(f"Error in main execution: {str(e)}")

if __name__ == "__main__":
    main()