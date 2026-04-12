# Interactive Issue Wizard Test Script (PowerShell)
# Tests the conversational AI-driven issue creation workflow

param(
    [string]$Token = ""
)

$BaseUrl = "http://localhost:3000"

# Colors
$Green = "Green"
$Blue = "Blue"
$Yellow = "Yellow"

if ([string]::IsNullOrEmpty($Token)) {
    Write-Host "No token provided. First logging in..." -ForegroundColor $Yellow
    
    $LoginBody = @{
        username = "arnav"
        password = "arnav123"
    } | ConvertTo-Json
    
    $LoginResponse = Invoke-RestMethod -Uri "$BaseUrl/login" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json" } `
        -Body $LoginBody
    
    $Token = $LoginResponse.token
    Write-Host "[OK] Got token: $($Token.Substring(0, 20))..." -ForegroundColor $Green
}

Write-Host ""
Write-Host "=== INTERACTIVE ISSUE WIZARD TEST ===" -ForegroundColor $Blue
Write-Host ""

# Step 1: Initialize wizard
Write-Host "Step 1: Initialize Wizard" -ForegroundColor $Yellow
$Step1 = Invoke-RestMethod -Uri "$BaseUrl/issue-wizard" `
    -Method POST `
    -Headers @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
} `
    -Body "{}"

$SessionId = $Step1.sessionId
Write-Host "[OK] Session ID: $SessionId" -ForegroundColor $Green
Write-Host "Question: $($Step1.question)"
Write-Host ""

# Step 2: Provide summary
Write-Host "Step 2: Provide Summary" -ForegroundColor $Yellow
$Summary = "Fix memory leak in user dashboard"
Write-Host "Responding: $Summary"

$Step2Body = @{
    sessionId = $SessionId
    response  = $Summary
} | ConvertTo-Json

$Step2 = Invoke-RestMethod -Uri "$BaseUrl/issue-wizard" `
    -Method POST `
    -Headers @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
} `
    -Body $Step2Body

Write-Host "Question: $($Step2.question)"
Write-Host "Options: $($Step2.options -join ', ')"
Write-Host ""

# Step 3: Provide priority
Write-Host "Step 3: Provide Priority" -ForegroundColor $Yellow
$Priority = "High"
Write-Host "Responding: $Priority"

$Step3Body = @{
    sessionId = $SessionId
    response  = $Priority
} | ConvertTo-Json

$Step3 = Invoke-RestMethod -Uri "$BaseUrl/issue-wizard" `
    -Method POST `
    -Headers @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
} `
    -Body $Step3Body

Write-Host "Question: $($Step3.question)"
Write-Host ""

# Step 4: Provide assignee
Write-Host "Step 4: Provide Assignee" -ForegroundColor $Yellow
$Assignee = "arnav"
Write-Host "Responding: $Assignee"

$Step4Body = @{
    sessionId = $SessionId
    response  = $Assignee
} | ConvertTo-Json

$Step4 = Invoke-RestMethod -Uri "$BaseUrl/issue-wizard" `
    -Method POST `
    -Headers @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
} `
    -Body $Step4Body

Write-Host "Question: $($Step4.question)"
Write-Host "Options: $($Step4.options -join ', ')"
Write-Host ""

# Step 5: Provide issue type
Write-Host "Step 5: Provide Issue Type" -ForegroundColor $Yellow
$IssueType = "Bug"
Write-Host "Responding: $IssueType"

$Step5Body = @{
    sessionId = $SessionId
    response  = $IssueType
} | ConvertTo-Json

$Step5 = Invoke-RestMethod -Uri "$BaseUrl/issue-wizard" `
    -Method POST `
    -Headers @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
} `
    -Body $Step5Body

Write-Host "Question: $($Step5.question)"
Write-Host ""

# Step 6: Provide description
Write-Host "Step 6: Provide Description" -ForegroundColor $Yellow
$Description = "Dashboard loads slowly when users have 100+ items. Appears to be memory not being freed properly."
Write-Host "Responding: $Description"

$Step6Body = @{
    sessionId = $SessionId
    response  = $Description
} | ConvertTo-Json

$Step6 = Invoke-RestMethod -Uri "$BaseUrl/issue-wizard" `
    -Method POST `
    -Headers @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
} `
    -Body $Step6Body

Write-Host "Question: $($Step6.question)"
Write-Host "Summary to confirm:"
Write-Host "  - Summary: $($Step6.summary.summary)"
Write-Host "  - Priority: $($Step6.summary.priority)"
Write-Host "  - Type: $($Step6.summary.issueType)"
Write-Host "  - Assignee: $($Step6.summary.assignee)"
Write-Host ""

# Step 7: Confirm creation
Write-Host "Step 7: Confirm Creation" -ForegroundColor $Yellow
Write-Host "Responding: yes"

$FinalBody = @{
    sessionId = $SessionId
    response  = "yes"
} | ConvertTo-Json

$Final = Invoke-RestMethod -Uri "$BaseUrl/issue-wizard" `
    -Method POST `
    -Headers @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
} `
    -Body $FinalBody

Write-Host ""
Write-Host "=== RESULT ===" -ForegroundColor $Green
Write-Host "Success: $($Final.success)"
Write-Host "Message: $($Final.message)"
Write-Host "Issue Key: $($Final.issueKey)"
Write-Host "Link: $($Final.link)"
Write-Host ""

if ([string]::IsNullOrEmpty($Final.issueKey)) {
    Write-Host "[x] Error creating issue" -ForegroundColor Red
    Write-Host $Final | ConvertTo-Json
}
else {
    Write-Host "[OK] Issue created successfully: $($Final.issueKey)" -ForegroundColor $Green
}
