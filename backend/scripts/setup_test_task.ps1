# Calculate a time 2 minutes from now
$TestTime = (Get-Date).AddMinutes(2)

$Action = New-ScheduledTaskAction `
    -Execute "C:\Users\whitn\OneDrive\Desktop\Senior\backend\scripts\run_daily_update.bat"

$Trigger = New-ScheduledTaskTrigger `
    -Once `
    -At $TestTime

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

$Task = Register-ScheduledTask `
    -TaskName "Her Garmin Test Update" `
    -Description "Test run of Garmin data update" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Force

Write-Host "Task scheduled to run at $TestTime"
Write-Host "Check daily_update.log after that time to see the results" 