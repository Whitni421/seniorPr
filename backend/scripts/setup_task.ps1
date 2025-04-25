$Action = New-ScheduledTaskAction `
    -Execute "C:\Users\whitn\OneDrive\Desktop\Senior\backend\scripts\run_daily_update.bat"

$Trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At 12am

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

$Task = Register-ScheduledTask `
    -TaskName "Her Garmin Daily Update" `
    -Description "Updates Garmin data for all users daily at midnight" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Force 