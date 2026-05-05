New-Item -ItemType Directory -Force -Path "app"

Copy-Item "clickshift_login\code.html" -Destination "app\login.html" -Force
Copy-Item "staff_dashboard\code.html" -Destination "app\staff_dashboard.html" -Force
Copy-Item "manager_dashboard_shift_management\code.html" -Destination "app\manager_dashboard.html" -Force
Copy-Item "staff_schedule_month_view\code.html" -Destination "app\staff_schedule.html" -Force
Copy-Item "weekly_board_shift_management\code.html" -Destination "app\weekly_board.html" -Force
Copy-Item "admin_pattern_builder_full_shift_support\code.html" -Destination "app\admin_pattern_builder.html" -Force

# Helper to avoid regex matching issues: just replace the specific <a href="#">Dashboard</a> strings
# We'll use simple string replacements

function Update-StringInFile {
    param([string]$File, [string]$Find, [string]$Replace)
    (Get-Content $File) | ForEach-Object { $_.Replace($Find, $Replace) } | Set-Content $File
}

# 1. Login Page -> Go to Staff Dashboard
Update-StringInFile "app\login.html" 'type="submit"' 'type="button" onclick="window.location.href=''staff_dashboard.html''"'
Update-StringInFile "app\login.html" '<a class="text-secondary font-h3 text-body-md hover:underline" href="#">Register your clinic</a>' '<a class="text-secondary font-h3 text-body-md hover:underline" href="manager_dashboard.html">Register your clinic (Manager Demo)</a>'

# 2. Staff Dashboard
Update-StringInFile "app\staff_dashboard.html" 'href="#">Dashboard' 'href="staff_dashboard.html">Dashboard'
Update-StringInFile "app\staff_dashboard.html" 'href="#">My Schedule' 'href="staff_schedule.html">My Schedule'
Update-StringInFile "app\staff_dashboard.html" 'href="#">Schedule Grid' 'href="staff_schedule.html">Schedule Grid'
Update-StringInFile "app\staff_dashboard.html" 'href="#">Sign Out' 'href="login.html">Sign Out'

# 3. Manager Dashboard
Update-StringInFile "app\manager_dashboard.html" 'href="#">Dashboard' 'href="manager_dashboard.html">Dashboard'
Update-StringInFile "app\manager_dashboard.html" 'href="#">Schedule Grid' 'href="weekly_board.html">Schedule Grid'
Update-StringInFile "app\manager_dashboard.html" 'href="#">Sign Out' 'href="login.html">Sign Out'

# 4. Staff Schedule
Update-StringInFile "app\staff_schedule.html" 'href="#">Dashboard' 'href="staff_dashboard.html">Dashboard'
Update-StringInFile "app\staff_schedule.html" 'href="#">Schedule Grid' 'href="staff_schedule.html">Schedule Grid'
Update-StringInFile "app\staff_schedule.html" 'href="#">Sign Out' 'href="login.html">Sign Out'

# 5. Weekly Board (Manager)
Update-StringInFile "app\weekly_board.html" 'href="#">Dashboard' 'href="manager_dashboard.html">Dashboard'
Update-StringInFile "app\weekly_board.html" 'href="#">Schedule Grid' 'href="weekly_board.html">Schedule Grid'
Update-StringInFile "app\weekly_board.html" 'href="#">Sign Out' 'href="login.html">Sign Out'

# 6. Admin Pattern Builder
Update-StringInFile "app\admin_pattern_builder.html" 'href="#">Dashboard' 'href="manager_dashboard.html">Dashboard'
Update-StringInFile "app\admin_pattern_builder.html" 'href="#">Schedule Grid' 'href="weekly_board.html">Schedule Grid'
Update-StringInFile "app\admin_pattern_builder.html" 'href="#">Pattern Builder' 'href="admin_pattern_builder.html">Pattern Builder'
Update-StringInFile "app\admin_pattern_builder.html" 'href="#">Sign Out' 'href="login.html">Sign Out'

Write-Host "Build Complete!"
